import { describe, expect, it, vi } from "vitest";
import { createLookupLimiter } from "./rate-limit";
vi.mock("server-only", () => ({}));

describe("lookup sliding-window limit", () => {
  it("admits at most three ReceitaWS requests per rolling minute, including across sessions", () => {
    const limiter = createLookupLimiter(3);
    expect(limiter.take(0)).toBe(0);
    expect(limiter.take(1000)).toBe(0);
    expect(limiter.take(2000)).toBe(0);
    expect(limiter.take(3000)).toBe(57);
    expect(limiter.take(59_999)).toBe(1);
    expect(limiter.take(60_000)).toBe(0);
    expect(limiter.take(60_001)).toBe(1);
  });
});
