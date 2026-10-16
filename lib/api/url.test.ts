import { describe, expect, it } from "vitest";
import { buildApiUrl, serializeQuery } from "./url";

describe("URL helpers", () => {
  it("serializes primitives, empty values and repeated keys without double encoding", () => {
    const query = serializeQuery({
      term: "café & chá", empty: "", zero: 0, active: false,
      omitted: undefined, absent: null, values: ["a b", null, undefined, "c/d"],
    });
    expect(query.get("term")).toBe("café & chá");
    expect(query.get("empty")).toBe("");
    expect(query.get("zero")).toBe("0");
    expect(query.get("active")).toBe("false");
    expect(query.has("omitted")).toBe(false);
    expect(query.has("absent")).toBe(false);
    expect(query.getAll("values")).toEqual(["a b", "c/d"]);
    expect(query.toString()).toContain("term=caf%C3%A9+%26+ch%C3%A1");
  });

  it.each([{}, { companyId: undefined }, { companyId: "" }, { companyId: "." }, { companyId: ".." }])(
    "rejects missing or unsafe path parameters: %j", (pathParams) => {
      expect(() => buildApiUrl("https://api.example.test/", "/companies/{companyId}", pathParams))
        .toThrow(expect.objectContaining({ kind: "request" }));
    },
  );

  it.each(["https://other.test/", "//other.test/", "/../companies", "/companies?x=1", "/companies#hash", "/\\other.test", "/companies/{broken"])(
    "rejects unsafe or unresolved paths: %s", (path) => {
      expect(() => buildApiUrl("https://api.example.test/", path))
        .toThrow(expect.objectContaining({ kind: "request" }));
    },
  );

  it.each([{ nested: {} }, { invalid: Number.NaN }, { invalid: Infinity }, { invalid: [true, {}] }])(
    "rejects unsupported query values: %j", (query) => {
      expect(() => serializeQuery(query)).toThrow(expect.objectContaining({ kind: "request" }));
    },
  );
});
