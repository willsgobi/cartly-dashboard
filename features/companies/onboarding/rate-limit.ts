import "server-only";

/** Sliding window shared by all sessions in this server process; no lookup payloads retained. */
export function createLookupLimiter(limit: number, windowMs = 60_000) {
  let attempts: number[] = [];
  return {
    take(now = Date.now()): number {
      attempts = attempts.filter((time) => time > now - windowMs);
      if (attempts.length >= limit) return Math.max(1, Math.ceil((attempts[0] + windowMs - now) / 1000));
      attempts.push(now);
      return 0;
    },
  };
}

// ReceitaWS public limit: 3/minute. ViaCEP limit below is an application throttle.
export const lookupLimiters = { cnpj: createLookupLimiter(3), cep: createLookupLimiter(20) };
