import { afterEach, describe, expect, it, vi } from "vitest";
import { getApiBaseUrl, validateApiBaseUrl } from "./environment";

afterEach(() => vi.unstubAllEnvs());

describe("API environment", () => {
  it.each([
    ["http://localhost:3001", "http://localhost:3001/"],
    ["https://api.example.test/v1/", "https://api.example.test/v1/"],
    [" https://api.example.test/v1/// ", "https://api.example.test/v1/"],
  ])("normalizes %s", (value, expected) => {
    expect(validateApiBaseUrl(value)).toBe(expected);
  });

  it.each([
    undefined, "", " ", "/api", "not a URL", "ftp://api.example.test",
    "https:api.example.test", "https://", "https://user:password@api.example.test",
    "https://api.example.test?secret=value", "https://api.example.test/#fragment",
    "https://api.example.test?", "https://api.example.test#",
  ])("rejects invalid or credential-bearing configuration: %j", (value) => {
    expect(() => validateApiBaseUrl(value)).toThrow(expect.objectContaining({ kind: "configuration" }));
  });

  it("reads the configured URL lazily in each environment", () => {
    vi.stubEnv("API_BASE_URL", "http://localhost:3001");
    expect(getApiBaseUrl()).toBe("http://localhost:3001/");
    vi.stubEnv("API_BASE_URL", "https://api.example.test/v1");
    expect(getApiBaseUrl()).toBe("https://api.example.test/v1/");
  });

  it("reports missing configuration without a development fallback", () => {
    vi.stubEnv("API_BASE_URL", undefined);
    expect(() => getApiBaseUrl()).toThrow(expect.objectContaining({ kind: "configuration" }));
  });
});
