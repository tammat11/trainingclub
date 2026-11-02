import { getRedis } from "./_election.js";

export default async function handler(req, res) {
  const redis = getRedis();
  const id = new URL(req.url, "http://local").searchParams.get("id") || "";
  const photo = redis && /^[\w-]{1,40}$/.test(id) ? await redis("HGET", "photos", id).catch(() => null) : null;

  if (!photo) {
    res.statusCode = 404;
    return res.end();
  }
  res.setHeader("Content-Type", "image/jpeg");
  // A candidate's photo never changes after nomination.
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  res.end(Buffer.from(photo.slice(photo.indexOf(",") + 1), "base64"));
}
