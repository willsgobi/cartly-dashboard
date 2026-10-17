// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompanyOnboardingForm } from "./CompanyOnboardingForm";
import { createCompany, lookupCompanyData } from "./api";
import { ApiError } from "../../../lib/api/errors";
import type { CreationResult, LookupFields } from "./schemas";

vi.mock("./api", () => ({ createCompany: vi.fn(), lookupCompanyData: vi.fn() }));
afterEach(cleanup);
beforeEach(() => {
  vi.mocked(createCompany).mockResolvedValue({ created: true, active: true, companyId: "new-company" });
  vi.mocked(lookupCompanyData).mockRejectedValue(new ApiError("network"));
});
const fields: LookupFields = { name: "Empresa encontrada", "address.street": "Rua encontrada", "address.number": "100", "address.city": "São Paulo", "address.state": "SP", "address.zipCode": "01001000", "address.country": "Brazil" };
type User = ReturnType<typeof userEvent.setup>;
async function firstStep(user: User) {
  await user.type(screen.getByLabelText(/^CNPJ/), "11.222.333/0001-81");
  await user.type(screen.getByLabelText(/^Razão social/), "Empresa manual");
}
async function manualAddress(user: User) {
  for (const [label, value] of [[/^CEP/, "01001-000"], [/^Logradouro/, "Rua manual"], [/^Número/, "25"], [/^Cidade/, "Cidade manual"], [/^Estado/, "SP"]] as const) {
    await user.type(screen.getByLabelText(label), value);
  }
}

describe("two-step company onboarding", () => {
  it("validates step one and preserves values when navigating back and forward", async () => {
    const user = userEvent.setup();
    render(<CompanyOnboardingForm />);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Informe a razão social.")).toBeDefined();
    expect(screen.getByText(/Etapa 1 de 2/)).toBeDefined();
    await firstStep(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.type(screen.getByLabelText(/^Número/), "27");
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByLabelText(/^Razão social/)).toHaveProperty("value", "Empresa manual");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByLabelText(/^Número/)).toHaveProperty("value", "27");
    expect(createCompany).not.toHaveBeenCalled();
  });
  it("does not query ReceitaWS on each keystroke and populates supported fields explicitly", async () => {
    vi.mocked(lookupCompanyData).mockResolvedValue(fields);
    const user = userEvent.setup();
    render(<CompanyOnboardingForm />);
    await user.type(screen.getByLabelText(/^CNPJ/), "11.222.333/0001-81");
    expect(lookupCompanyData).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Consultar CNPJ" }));
    expect(await screen.findByText(/Dados da empresa encontrados/)).toBeDefined();
    expect(screen.getByLabelText(/^Razão social/)).toHaveProperty("value", "Empresa encontrada");
    expect(lookupCompanyData).toHaveBeenCalledWith("cnpj", "11222333000181", expect.any(AbortSignal));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByLabelText(/^CEP/)).toHaveProperty("value", "01001000");
    await user.click(screen.getByLabelText(/^Número/));
    expect(lookupCompanyData).toHaveBeenCalledOnce();
    expect(createCompany).not.toHaveBeenCalled();
  });
  it("rejects an invalid CNPJ before lookup", async () => {
    const user = userEvent.setup();
    render(<CompanyOnboardingForm />);
    await user.type(screen.getByLabelText(/^CNPJ/), "11111111111111");
    await user.click(screen.getByRole("button", { name: "Consultar CNPJ" }));
    expect(await screen.findByText(/Informe um CNPJ válido com 14/)).toBeDefined();
    expect(lookupCompanyData).not.toHaveBeenCalled();
  });
  it("allows complete manual creation after lookups fail, sends normalized data and disables duplicate submission", async () => {
    const pending = Promise.withResolvers<CreationResult>();
    vi.mocked(createCompany).mockReturnValue(pending.promise);
    const user = userEvent.setup();
    render(<CompanyOnboardingForm />);
    await firstStep(user);
    await user.click(screen.getByRole("button", { name: "Consultar CNPJ" }));
    expect(await screen.findByText(/Não foi possível consultar o CNPJ/)).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await manualAddress(user);
    await user.dblClick(screen.getByRole("button", { name: "Criar empresa" }));
    expect(createCompany).toHaveBeenCalledExactlyOnceWith({ name: "Empresa manual", document: "11222333000181", address: { street: "Rua manual", number: "25", city: "Cidade manual", state: "SP", zipCode: "01001000", country: "Brazil" } });
    expect(screen.getByRole("button", { name: /Criar empresa/ })).toHaveProperty("disabled", true);
    await act(async () => { pending.resolve({ created: true, active: true, companyId: "new-company" }); });
    expect(await screen.findByText("Empresa criada. Abrindo o painel...")).toBeDefined();
  });
  it("preserves user changes made while a CNPJ lookup is pending", async () => {
    const pending = Promise.withResolvers<LookupFields>();
    vi.mocked(lookupCompanyData).mockReturnValue(pending.promise);
    const user = userEvent.setup();
    render(<CompanyOnboardingForm />);
    await firstStep(user);
    await user.click(screen.getByRole("button", { name: "Consultar CNPJ" }));
    expect(screen.getByRole("button", { name: /Consultar CNPJ/ }).getAttribute("aria-busy")).toBe("true");
    expect(screen.getByLabelText(/^Razão social/)).toHaveProperty("disabled", false);
    await user.clear(screen.getByLabelText(/^Razão social/));
    await user.type(screen.getByLabelText(/^Razão social/), "Nome editado depois");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.type(screen.getByLabelText(/^Logradouro/), "Rua editada depois");
    await act(async () => { pending.resolve(fields); });
    expect(screen.getByLabelText(/^Logradouro/)).toHaveProperty("value", "Rua editada depois");
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByLabelText(/^Razão social/)).toHaveProperty("value", "Nome editado depois");
  });
  it("preserves the address number and late manual edits on CEP lookup", async () => {
    const pending = Promise.withResolvers<LookupFields>();
    vi.mocked(lookupCompanyData).mockReturnValue(pending.promise);
    const user = userEvent.setup();
    render(<CompanyOnboardingForm />);
    await firstStep(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.type(screen.getByLabelText(/^Número/), "77");
    await user.type(screen.getByLabelText(/^CEP/), "01001000");
    await user.click(screen.getByRole("button", { name: "Consultar CEP" }));
    await user.type(screen.getByLabelText(/^Logradouro/), "Minha rua");
    await act(async () => { pending.resolve(fields); });
    expect(screen.getByLabelText(/^Número/)).toHaveProperty("value", "77");
    expect(screen.getByLabelText(/^Logradouro/)).toHaveProperty("value", "Minha rua");
    expect(screen.getByLabelText(/^Cidade/)).toHaveProperty("value", "São Paulo");
    expect(lookupCompanyData).toHaveBeenCalledOnce();
  });
  it("ignores stale CEP responses when the user changes the query, and looks up the new CEP", async () => {
    const old = Promise.withResolvers<LookupFields>();
    vi.mocked(lookupCompanyData).mockReturnValueOnce(old.promise).mockResolvedValue({ "address.city": "Nova cidade", "address.zipCode": "20040002" });
    const user = userEvent.setup();
    render(<CompanyOnboardingForm />);
    await firstStep(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.type(screen.getByLabelText(/^CEP/), "01001000");
    await user.click(screen.getByRole("button", { name: "Consultar CEP" }));
    await user.clear(screen.getByLabelText(/^CEP/));
    await user.type(screen.getByLabelText(/^CEP/), "20040002");
    await user.click(screen.getByRole("button", { name: "Consultar CEP" }));
    await waitFor(() => expect(screen.getByLabelText(/^Cidade/)).toHaveProperty("value", "Nova cidade"));
    await act(async () => { old.resolve(fields); });
    expect(screen.getByLabelText(/^Cidade/)).toHaveProperty("value", "Nova cidade");
    expect(screen.getByLabelText(/^CEP/)).toHaveProperty("value", "20040002");
    expect(lookupCompanyData).toHaveBeenCalledTimes(2);
  });
  it("keeps form data on a duplicate document response", async () => {
    vi.mocked(createCompany).mockRejectedValue(new ApiError("http", { status: 409 }));
    const user = userEvent.setup();
    render(<CompanyOnboardingForm />);
    await firstStep(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await manualAddress(user);
    await user.click(screen.getByRole("button", { name: "Criar empresa" }));
    expect(await screen.findByText(/Já existe uma empresa com este CNPJ/)).toBeDefined();
    expect(screen.getByLabelText(/^Número/)).toHaveProperty("value", "25");
    expect(screen.getByRole("button", { name: "Criar empresa" })).toHaveProperty("disabled", false);
  });
  it("offers only access synchronization after creation commits but the refreshed list is unavailable", async () => {
    vi.mocked(createCompany).mockResolvedValue({ created: true, active: false, companyId: "new-company" });
    const user = userEvent.setup();
    render(<CompanyOnboardingForm />);
    await firstStep(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await manualAddress(user);
    await user.click(screen.getByRole("button", { name: "Criar empresa" }));
    const retry = await screen.findByRole("button", { name: "Verificar acesso e continuar" });
    expect(retry.closest("form")?.getAttribute("action")).toBe("/api/companies/active");
    expect(retry.closest("form")?.querySelector("input")?.value).toBe("new-company");
    expect(screen.getByRole("button", { name: "Criar empresa" })).toHaveProperty("disabled", true);
    expect(createCompany).toHaveBeenCalledOnce();
  });
});
