import { redis } from "../../queues/redis.js";

const CACHE_TTL = 30;
const LOCK_TTL = 5;
const LOCK_RETRY_MS = 20;

export function getSeatCacheKey(eventId) {
  return `event:${eventId}:seats`;
}

function getSeatLockKey(eventId) {
  return `lock:event:${eventId}:seats`;
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

async function acquireLock(eventId) {
  const lockKey = getSeatLockKey(eventId);

  const lockValue = `${process.pid}-${Date.now()}-${Math.random()}`;

  const acquired = await redis.set(
    lockKey,
    lockValue,
    "NX",
    "EX",
    LOCK_TTL
  );

  if (acquired !== "OK") {
    return null;
  }

  return {
    lockKey,
    lockValue,
  };
}

async function releaseLock(lockKey, lockValue) {
  const RELEASE_SCRIPT = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    end

    return 0
  `;

  await redis.eval(
    RELEASE_SCRIPT,
    1,
    lockKey,
    lockValue
  );
}

export async function getSeatsWithStampedeProtection(
  eventId,
  loadSeats
) {
  const cachedSeats = await getCachedSeats(eventId);

  if (cachedSeats) {
    console.log("Seat cache HIT");
    return cachedSeats;
  }

  console.log("Seat cache MISS");

  const lock = await acquireLock(eventId);

  if (lock) {
    try {
      // Double-check after acquiring the lock.
      const cachedAfterLock = await getCachedSeats(
        eventId
      );

      if (cachedAfterLock) {
        console.log(
          "Seat cache HIT after lock"
        );

        return cachedAfterLock;
      }

      console.log(
        "Loading seats from PostgreSQL"
      );

      const seats = await loadSeats();

      await cacheSeats(eventId, seats);

      return seats;
    } finally {
      await releaseLock(
        lock.lockKey,
        lock.lockValue
      );
    }
  }

  // Another request is loading the cache.
  // Wait briefly and retry.
  for (let attempt = 0; attempt < 100; attempt++) {
    await new Promise((resolve) =>
      setTimeout(resolve, LOCK_RETRY_MS)
    );

    const cachedSeats = await getCachedSeats(
      eventId
    );

    if (cachedSeats) {
      console.log(
        "Seat cache HIT after waiting"
      );

      return cachedSeats;
    }
  }

  throw new Error(
    "Unable to load seat cache"
  );
}

export async function invalidateSeatCache(eventId) {
  const key = getSeatCacheKey(eventId);

  await redis.del(key);
}