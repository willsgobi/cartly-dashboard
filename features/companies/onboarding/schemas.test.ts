import { describe, expect, it } from "vitest";
import { cnpjSchema, createCompanySchema, isValidCnpj, zipCodeSchema } from "./schemas";

describe("company onboarding validation", () => {
  it.each(["11222333000181", "04252011000110"])("validates numeric CNPJ %s", (cnpj) => {
    expect(isValidCnpj(cnpj)).toBe(true);
  });
  it("normalizes a formatted CNPJ", () => { expect(cnpjSchema.parse("11.222.333/0001-81")).toBe("11222333000181"); });
  it.each(["", "11111111111111", "00000000000000", "11222333000182", "1122233300018", "abc11222333000181"])("rejects invalid CNPJ %s", (value) => {
    expect(cnpjSchema.safeParse(value).success).toBe(false);
  });
  it("preserves leading CEP zeros and rejects invalid formats", () => {
    expect(zipCodeSchema.parse("01001-000")).toBe("01001000");
    expect(zipCodeSchema.parse("01.001-000")).toBe("01001000");
    for (const value of ["123", "010010001", "abc01001000"]) expect(zipCodeSchema.safeParse(value).success).toBe(false);
  });
  it("produces only CreateCompanyDto fields with required editable address strings", () => {
    const body = { document: "11.222.333/0001-81", name: " Teste ", extra: "unused", address: { zipCode: "01001-000", street: "Rua", number: "s/n", city: "Cidade", state: "SP", country: "Brazil", district: "unsupported" } };
    expect(createCompanySchema.parse(body)).toEqual({ document: "11222333000181", name: "Teste", address: { zipCode: "01001000", street: "Rua", number: "s/n", city: "Cidade", state: "SP", country: "Brazil" } });
    expect(createCompanySchema.safeParse({ ...body, address: { ...body.address, number: "" } }).success).toBe(false);
  });
});
