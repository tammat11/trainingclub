// Shared election logic. The leading underscore keeps Vercel from exposing this file as a route.

// Almaty time (UTC+5). The admin can override the phase in Redis.
export const SCHEDULE = {
  nominationStart: "2026-11-02T00:00:00+05:00",
  votingStart: "2026-11-04T20:00:00+05:00",
  votingEnd: "2026-11-08T00:00:00+05:00",
};

export const POSITIONS = {
  president: "Президент",
  officer: "Офицер",
};

export const TENURES = {
  lt1: "Меньше 1 года",
  "1-2": "1–2 года",
  "2-3": "2–3 года",
  "3+": "Больше 3 лет",
};

export const PHASES = ["before", "nomination", "voting", "closed"];
const PREFIX = "tc-election:";

export const json = (res, status, body) => res.status(status).json(body);

export const clean = (value, limit) =>
  typeof value === "string" ? value.trim().slice(0, limit) : "";

// Kazakhstan numbers come as +7..., 8... or 7...; the last 10 digits identify the line.
export const normalizePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 11 && /^[78]/.test(digits)) return digits.slice(1);
  return "";
};

const upstash = () => {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return async (...command) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || "Redis error");
    return data.result;
  };
};

// In-memory subset of Redis for local development only (enabled by vite.config.mjs).
const memory = () => {
  const db = (globalThis.__electionMemory ||= new Map());
  const set = (key) => db.get(key) || db.set(key, new Set()).get(key);
  const hash = (key) => db.get(key) || db.set(key, new Map()).get(key);
  const commands = {
    GET: (key) => db.get(key) ?? null,
    SET: (key, value) => (db.set(key, value), "OK"),
    DEL: (key) => (db.delete(key) ? 1 : 0),
    SADD: (key, ...members) => members.filter((m) => !set(key).has(m) && set(key).add(m)).length,
    SREM: (key, ...members) => members.filter((m) => set(key).delete(m)).length,
    SISMEMBER: (key, member) => (set(key).has(member) ? 1 : 0),
    SCARD: (key) => set(key).size,
    HSET: (key, field, value) => (hash(key).set(field, String(value)), 1),
    HGET: (key, field) => hash(key).get(field) ?? null,
    HGETALL: (key) => [...hash(key)].flat(),
    HINCRBY: (key, field, by) => {
      const next = Number(hash(key).get(field) || 0) + Number(by);
      hash(key).set(field, String(next));
      return next;
    },
  };
  return async (name, ...args) => commands[name](...args);
};

export const getRedis = () => {
  const run = upstash() || (process.env.ELECTION_MEMORY_STORE === "1" ? memory() : null);
  if (!run) return null;
  return (name, key, ...args) => run(name, PREFIX + key, ...args);
};

const pairs = (flat) => {
  const out = {};
  for (let i = 0; i < (flat || []).length; i += 2) out[flat[i]] = flat[i + 1];
  return out;
};

export const getPhase = async (redis, now = Date.now()) => {
  const override = await redis("GET", "phase");
  if (PHASES.includes(override)) return override;
  if (now < Date.parse(SCHEDULE.nominationStart)) return "before";
  if (now < Date.parse(SCHEDULE.votingStart)) return "nomination";
  if (now < Date.parse(SCHEDULE.votingEnd)) return "voting";
  return "closed";
};

export const getCandidates = async (redis) =>
  Object.values(pairs(await redis("HGETALL", "candidates")))
    .map((raw) => JSON.parse(raw))
    .sort((a, b) => a.createdAt - b.createdAt);

// Residents with less than a year in the club are filtered out before voting.
export const isEligible = (candidate) => !candidate.hidden && candidate.tenure !== "lt1";

export const getResults = async (redis) => {
  const results = {};
  for (const position of Object.keys(POSITIONS)) {
    const counts = pairs(await redis("HGETALL", `votes:${position}`));
    results[position] = {
      voters: Number(await redis("SCARD", `voted:${position}`)),
      counts: Object.fromEntries(Object.entries(counts).map(([id, n]) => [id, Number(n)])),
    };
  }
  return results;
};
