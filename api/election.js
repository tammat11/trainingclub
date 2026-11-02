import { randomUUID } from "node:crypto";
import {
  POSITIONS,
  SCHEDULE,
  TENURES,
  clean,
  getCandidates,
  getPhase,
  getRedis,
  getResults,
  isEligible,
  json,
  normalizePhone,
} from "./_election.js";

const publicCandidate = (c) => ({
  id: c.id,
  name: c.name,
  position: c.position,
  tenure: c.tenure,
  plan: c.plan,
  eligible: isEligible(c),
});

const state = async (redis) => {
  const phase = await getPhase(redis);
  const candidates = (await getCandidates(redis)).filter((c) => !c.hidden).map(publicCandidate);
  const results = phase === "voting" || phase === "closed" ? await getResults(redis) : null;
  return { phase, schedule: SCHEDULE, positions: POSITIONS, tenures: TENURES, candidates, results };
};

const nominate = async (redis, body, phone) => {
  const name = clean(body.name, 120);
  const position = clean(body.position, 20);
  const tenure = clean(body.tenure, 10);
  const plan = clean(body.plan, 2000);

  if (name.length < 3 || !POSITIONS[position] || !TENURES[tenure] || plan.length < 10) {
    return [400, { error: "Заполните ФИО, должность, стаж и план развития клуба" }];
  }
  if (!(await redis("SADD", "candidacy", `${position}:${phone}`))) {
    return [409, { error: `Вы уже выдвинули кандидатуру на должность «${POSITIONS[position]}»` }];
  }

  const candidate = {
    id: randomUUID().slice(0, 8),
    name,
    position,
    tenure,
    plan,
    phone,
    createdAt: Date.now(),
    hidden: false,
  };
  await redis("HSET", "candidates", candidate.id, JSON.stringify(candidate));
  return [200, { ok: true }];
};

const vote = async (redis, body, phone) => {
  const choices = body.choices && typeof body.choices === "object" ? body.choices : {};
  const candidates = await getCandidates(redis);
  const picked = Object.keys(POSITIONS)
    .filter((position) => choices[position])
    .map((position) => [position, candidates.find((c) => c.id === choices[position])]);

  if (!picked.length || picked.some(([position, c]) => !c || c.position !== position || !isEligible(c))) {
    return [400, { error: "Выберите кандидата из списка" }];
  }

  const recorded = [];
  const repeated = [];
  for (const [position, candidate] of picked) {
    // SADD is atomic, so a second ballot from the same phone never reaches HINCRBY.
    if (await redis("SADD", `voted:${position}`, phone)) {
      await redis("HINCRBY", `votes:${position}`, candidate.id, 1);
      recorded.push(position);
    } else {
      repeated.push(position);
    }
  }

  if (!recorded.length) {
    return [409, { error: "С этого номера уже проголосовали. Повторное голосование невозможно" }];
  }
  return [200, { ok: true, recorded, repeated }];
};

export default async function handler(req, res) {
  const redis = getRedis();
  if (!redis) return json(res, 503, { error: "Голосование пока не настроено" });

  try {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "no-store");
      return json(res, 200, await state(redis));
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return json(res, 405, { error: "Метод не поддерживается" });
    }

    const body = req.body || {};
    // Hidden field: browsers leave it empty, basic spam bots often fill it.
    if (body.website) return json(res, 200, { ok: true });

    const action = body.action;
    if (action !== "nominate" && action !== "vote") {
      return json(res, 400, { error: "Неизвестное действие" });
    }
    const phase = await getPhase(redis);
    if ((action === "nominate" && phase !== "nomination") || (action === "vote" && phase !== "voting")) {
      return json(res, 403, { error: "Этот этап сейчас закрыт" });
    }

    const phone = normalizePhone(body.phone);
    if (!phone || !(await redis("SISMEMBER", "residents", phone))) {
      return json(res, 403, { error: "Номер не найден в списке резидентов клуба" });
    }

    const [status, result] = await (action === "nominate" ? nominate : vote)(redis, body, phone);
    return json(res, status, result);
  } catch {
    return json(res, 502, { error: "Сервис временно недоступен. Попробуйте позже" });
  }
}
