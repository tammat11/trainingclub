import { timingSafeEqual } from "node:crypto";
import { PHASES, getCandidates, getPhase, getRedis, getResults, json, normalizePhone } from "./_election.js";

const sameKey = (given, expected) => {
  const a = Buffer.from(String(given || ""));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

const overview = async (redis) => ({
  phase: await getPhase(redis),
  override: (await redis("GET", "phase")) || "auto",
  residents: Number(await redis("SCARD", "residents")),
  candidates: await getCandidates(redis),
  results: await getResults(redis),
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Метод не поддерживается" });
  }

  const adminKey = process.env.ELECTION_ADMIN_KEY;
  const redis = getRedis();
  if (!adminKey || !redis) return json(res, 503, { error: "Голосование пока не настроено" });

  const body = req.body || {};
  if (!sameKey(body.key, adminKey)) return json(res, 401, { error: "Неверный ключ" });

  try {
    if (body.action === "residents") {
      const lines = String(body.phones || "").split(/[\n,;]+/).map((l) => l.trim()).filter(Boolean);
      const phones = lines.map(normalizePhone).filter(Boolean);
      const invalid = lines.filter((l) => !normalizePhone(l));
      const added = phones.length ? await redis("SADD", "residents", ...phones) : 0;
      return json(res, 200, { ok: true, added, invalid, ...(await overview(redis)) });
    }

    if (body.action === "hide" || body.action === "show") {
      const raw = await redis("HGET", "candidates", String(body.id || ""));
      if (!raw) return json(res, 404, { error: "Кандидат не найден" });
      const candidate = { ...JSON.parse(raw), hidden: body.action === "hide" };
      await redis("HSET", "candidates", candidate.id, JSON.stringify(candidate));
    } else if (body.action === "phase") {
      if (body.phase === "auto") await redis("DEL", "phase");
      else if (PHASES.includes(body.phase)) await redis("SET", "phase", body.phase);
      else return json(res, 400, { error: "Неизвестный этап" });
    } else if (body.action !== "overview") {
      return json(res, 400, { error: "Неизвестное действие" });
    }

    return json(res, 200, { ok: true, ...(await overview(redis)) });
  } catch {
    return json(res, 502, { error: "Сервис временно недоступен. Попробуйте позже" });
  }
}
