import { redis } from "../../queues/redis.js";

const CACHE_TTL = 30;

export function getSeatCacheKey(eventId) {
  return `event:${eventId}:seats`;
}

export async function getCachedSeats(eventId) {
  const key = getSeatCacheKey(eventId);

  const cached = await redis.get(key);

  if (!cached) {
    return null;
  }

  return JSON.parse(cached);
}

export async function cacheSeats(eventId, seats) {
  const key = getSeatCacheKey(eventId);

  await redis.set(
    key,
    JSON.stringify(seats),
    "EX",
    CACHE_TTL
  );
}

export async function invalidateSeatCache(eventId) {
  const key = getSeatCacheKey(eventId);

  await redis.del(key);
}