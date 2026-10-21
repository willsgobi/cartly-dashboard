// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompanySettingsManager } from "./CompanySettingsManager";
import { ActiveCompanyProvider } from "../ActiveCompanyContext";
import { fetchCompanyDetails, saveCompanyInformation, saveCompanyAddress } from "./api";
import { lookupCompanyData } from "../onboarding/api";
import { ApiError } from "../../../lib/api/errors";
import { companies, details, address } from "./test-fixtures";
import type { CompanyDetails, CompanyAddress } from "./schemas";
import type { LookupFields } from "../onboarding/schemas";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("./api", async (original) => ({ ...await original<typeof import("./api")>(), fetchCompanyDetails: vi.fn(), saveCompanyInformation: vi.fn(), saveCompanyAddress: vi.fn() }));
vi.mock("../onboarding/api", () => ({ lookupCompanyData: vi.fn() }));
beforeEach(() => {
  vi.mocked(fetchCompanyDetails).mockReset().mockResolvedValue(details);
  vi.mocked(saveCompanyInformation).mockReset().mockResolvedValue(details);
  vi.mocked(saveCompanyAddress).mockReset().mockResolvedValue(address);
  vi.mocked(lookupCompanyData).mockReset().mockResolvedValue({ "address.street": "Rua consultada", "address.city": "Campinas", "address.state": "SP" });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
});
afterEach(cleanup);
const view = (company = companies[0]) => <ActiveCompanyProvider companies={companies} activeCompany={company}><CompanySettingsManager /></ActiveCompanyProvider>;
async function ready() { const rendered = render(view()); await screen.findByRole("form", { name: "Dados da empresa" }); return { user: userEvent.setup(), rendered }; }
async function editAddress(index = 1) { const state = await ready(); await state.user.click(screen.getByRole("button", { name: `Editar endereço ${index}` })); return state; }

describe("active company settings UI", () => {
  it("loads company details, all actual addresses and disables unchanged saves", async () => {
    const pending = Promise.withResolvers<CompanyDetails>(); vi.mocked(fetchCompanyDetails).mockReturnValue(pending.promise);
    render(view()); expect(screen.getByRole("status").textContent).toContain("Carregando");
    await act(async () => pending.resolve(details));
    expect(screen.getByLabelText(/^Razão social/)).toHaveProperty("value", details.name);
    expect(screen.getByLabelText(/^CNPJ/)).toHaveProperty("value", "11.222.333/0001-81");
    expect(screen.getByText("Rua original, 001")).toBeDefined(); expect(screen.getByText("Outra rua, 22")).toBeDefined();
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toHaveProperty("disabled", true);
    fireEvent.submit(screen.getByRole("form", { name: "Dados da empresa" }));
    await waitFor(() => expect(saveCompanyInformation).not.toHaveBeenCalled());
  });
  it("sends partial company updates and refreshes details plus the authoritative F06 header", async () => {
    const updated = { ...details, name: "Empresa atualizada" };
    vi.mocked(saveCompanyInformation).mockResolvedValue(updated);
    vi.mocked(fetchCompanyDetails).mockResolvedValueOnce(details).mockResolvedValue(updated);
    const { user } = await ready();
    await user.clear(screen.getByLabelText(/^Razão social/)); await user.type(screen.getByLabelText(/^Razão social/), updated.name);
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(saveCompanyInformation).toHaveBeenCalledExactlyOnceWith("a", { name: updated.name }, expect.any(AbortSignal));
    expect(refresh).toHaveBeenCalledOnce();
    await waitFor(() => expect(fetchCompanyDetails).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("status").textContent).toContain("atualizados com sucesso");
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar alterações" })).toHaveProperty("disabled", true));
  });
  it("keeps CNPJ read-only, validates required name and Cancel restores existing values", async () => {
    const { user } = await ready();
    const document = screen.getByLabelText(/^CNPJ/);
    expect(document).toHaveProperty("readOnly", true);
    await user.type(document, "04252011000110");
    expect(document).toHaveProperty("value", "11.222.333/0001-81");
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toHaveProperty("disabled", true);
    await user.clear(screen.getByLabelText(/^Razão social/)); fireEvent.submit(screen.getByRole("form", { name: "Dados da empresa" }));
    expect(await screen.findByText("Informe a razão social.")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByLabelText(/^Razão social/)).toHaveProperty("value", details.name); expect(saveCompanyInformation).not.toHaveBeenCalled();
  });
  it.each([400, 403, 404, 409, 500, undefined])("preserves information after HTTP/network error %s", async (status) => {
    vi.mocked(saveCompanyInformation).mockRejectedValue(new ApiError(status ? "http" : "network", { status }));
    const { user } = await ready(); await user.type(screen.getByLabelText(/^Razão social/), " alterada"); await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByRole("alert")).toBeDefined(); expect(screen.getByLabelText(/^Razão social/)).toHaveProperty("value", details.name + " alterada");
    expect(refresh).not.toHaveBeenCalled();
    if (status === 409) expect(screen.getByRole("alert").textContent).toContain("CNPJ já está cadastrado");
  });
  it("prevents duplicate company submissions and competing address edits", async () => {
    const pending = Promise.withResolvers<CompanyDetails>(); vi.mocked(saveCompanyInformation).mockReturnValue(pending.promise);
    const { user } = await ready(); await user.type(screen.getByLabelText(/^Razão social/), " nova");
    await user.dblClick(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(saveCompanyInformation).toHaveBeenCalledOnce(); expect(screen.getByRole("button", { name: "Editar endereço 1" })).toHaveProperty("disabled", true);
    await act(async () => pending.reject(new ApiError("network")));
  });
  it("lists an empty address array without inventing creation/deletion controls", async () => {
    vi.mocked(fetchCompanyDetails).mockResolvedValue({ ...details, addresses: [] }); await ready();
    expect(screen.getByText("Nenhum endereço cadastrado para esta empresa.")).toBeDefined(); expect(screen.queryByRole("button", { name: /^Editar endereço/ })).toBeNull();
  });
  it("edits the selected address only; number is read-only and omitted from partial PATCH", async () => {
    const { user } = await editAddress(2);
    const dialog = within(screen.getByRole("dialog")); expect(dialog.getByLabelText("Número")).toHaveProperty("value", "22"); expect(dialog.getByLabelText("Número")).toHaveProperty("readOnly", true);
    expect(dialog.getByRole("button", { name: "Salvar alterações" })).toHaveProperty("disabled", true);
    await user.clear(dialog.getByLabelText(/^Rua/)); await user.type(dialog.getByLabelText(/^Rua/), "Rua nova");
    await user.click(dialog.getByRole("button", { name: "Salvar alterações" }));
    expect(saveCompanyAddress).toHaveBeenCalledExactlyOnceWith("a", "address-2", { street: "Rua nova" }, expect.any(AbortSignal));
    expect(await screen.findByText("Endereço atualizado com sucesso.")).toBeDefined(); expect(screen.queryByRole("dialog")).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Editar endereço 2" })));
  });
  it("preserves unrelated company form edits when an address is saved/refreshed", async () => {
    const { user } = await ready(); await user.type(screen.getByLabelText(/^Razão social/), " não salva");
    await user.click(screen.getByRole("button", { name: "Editar endereço 1" })); const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText(/^Rua/), " nova"); await user.click(dialog.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Editar endereço 1" })).toHaveProperty("disabled", false));
    expect(screen.getByLabelText(/^Razão social/)).toHaveProperty("value", details.name + " não salva");
  });
  it("reuses ViaCEP lookup, preserves number, and keeps returned fields editable", async () => {
    const { user } = await editAddress(); const dialog = within(screen.getByRole("dialog"));
    await user.clear(dialog.getByLabelText(/^CEP/)); await user.type(dialog.getByLabelText(/^CEP/), "13000-000"); await user.click(dialog.getByRole("button", { name: "Consultar CEP" }));
    expect(lookupCompanyData).toHaveBeenCalledExactlyOnceWith("cep", "13000000", expect.any(AbortSignal), "/dashboard/settings/company");
    expect(await dialog.findByText("Endereço encontrado. Confira os dados.")).toBeDefined();
    expect(dialog.getByLabelText(/^Rua/)).toHaveProperty("value", "Rua consultada"); expect(dialog.getByLabelText("Número")).toHaveProperty("value", "001");
    await user.type(dialog.getByLabelText(/^Rua/), " manual"); expect(dialog.getByLabelText(/^Rua/)).toHaveProperty("value", "Rua consultada manual");
  });
  it("allows manual editing when ViaCEP fails", async () => {
    vi.mocked(lookupCompanyData).mockRejectedValue(new ApiError("network")); const { user } = await editAddress(); const dialog = within(screen.getByRole("dialog"));
    await user.click(dialog.getByRole("button", { name: "Consultar CEP" })); expect(await dialog.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("Informe o endereço manualmente"));
    await user.type(dialog.getByLabelText(/^Rua/), " manual"); await user.click(dialog.getByRole("button", { name: "Salvar alterações" })); expect(saveCompanyAddress).toHaveBeenCalledOnce();
  });
  it("does not overwrite fields edited while ViaCEP is pending", async () => {
    const pending = Promise.withResolvers<LookupFields>(); vi.mocked(lookupCompanyData).mockReturnValue(pending.promise);
    const { user } = await editAddress(); const dialog = within(screen.getByRole("dialog")); await user.click(dialog.getByRole("button", { name: "Consultar CEP" }));
    await user.clear(dialog.getByLabelText(/^Rua/)); await user.type(dialog.getByLabelText(/^Rua/), "Rua digitada");
    await act(async () => pending.resolve({ "address.street": "Antiga resposta", "address.city": "Cidade consultada" }));
    expect(dialog.getByLabelText(/^Rua/)).toHaveProperty("value", "Rua digitada"); expect(dialog.getByLabelText(/^Cidade/)).toHaveProperty("value", "Cidade consultada");
  });
  it("ignores obsolete ZIP lookup responses and aborts them on company switch", async () => {
    const pending = Promise.withResolvers<LookupFields>(); vi.mocked(lookupCompanyData).mockReturnValue(pending.promise);
    const { user, rendered } = await editAddress(); const dialog = within(screen.getByRole("dialog")); await user.click(dialog.getByRole("button", { name: "Consultar CEP" }));
    const signal = vi.mocked(lookupCompanyData).mock.calls[0][2];
    await user.type(dialog.getByLabelText(/^CEP/), "9"); expect(signal.aborted).toBe(true);
    vi.mocked(fetchCompanyDetails).mockResolvedValue({ ...details, ...companies[1], addresses: [] });
    rendered.rerender(view(companies[1])); await act(async () => pending.resolve({ "address.street": "Outra empresa" }));
    expect(screen.queryByRole("dialog")).toBeNull(); expect(screen.queryByText("Outra empresa")).toBeNull();
    expect(await screen.findByText("Nenhum endereço cadastrado para esta empresa.")).toBeDefined();
  });
  it("preserves address fields and locks dismissal during a pending mutation", async () => {
    const pending = Promise.withResolvers<CompanyAddress>(); vi.mocked(saveCompanyAddress).mockReturnValue(pending.promise);
    const { user } = await editAddress(); const dialog = within(screen.getByRole("dialog")); await user.type(dialog.getByLabelText(/^Rua/), " nova");
    await user.dblClick(dialog.getByRole("button", { name: "Salvar alterações" })); expect(saveCompanyAddress).toHaveBeenCalledOnce();
    expect(dialog.getByRole("button", { name: "Cancelar" })).toHaveProperty("disabled", true);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true })); expect(screen.getByRole("dialog")).toBeDefined();
    await act(async () => pending.reject(new ApiError("http", { status: 403 })));
    expect(await dialog.findByRole("alert")).toBeDefined(); expect(dialog.getByLabelText(/^Rua/)).toHaveProperty("value", "Rua original nova");
  });
  it("cancels company requests and ignores late mutation success after changing active company", async () => {
    const pending = Promise.withResolvers<CompanyDetails>(); vi.mocked(saveCompanyInformation).mockReturnValue(pending.promise);
    const { user, rendered } = await ready(); await user.type(screen.getByLabelText(/^Razão social/), " nova"); await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    const signal = vi.mocked(saveCompanyInformation).mock.calls[0][2];
    vi.mocked(fetchCompanyDetails).mockResolvedValue({ ...details, ...companies[1], addresses: [] }); rendered.rerender(view(companies[1]));
    expect(signal.aborted).toBe(true); await act(async () => pending.resolve(details));
    await waitFor(() => expect(screen.getByLabelText(/^Razão social/)).toHaveProperty("value", companies[1].name)); expect(refresh).not.toHaveBeenCalled();
    expect(screen.queryByText("Dados da empresa atualizados com sucesso.")).toBeNull();
  });
  it("ignores a late detail response from a previously active company", async () => {
    const pending = Promise.withResolvers<CompanyDetails>(); vi.mocked(fetchCompanyDetails).mockReturnValueOnce(pending.promise).mockResolvedValue({ ...details, ...companies[1], addresses: [] });
    const rendered = render(view()); const signal = vi.mocked(fetchCompanyDetails).mock.calls[0][1]; rendered.rerender(view(companies[1]));
    await act(async () => pending.resolve(details)); expect(signal.aborted).toBe(true);
    await waitFor(() => expect(screen.getByLabelText(/^Razão social/)).toHaveProperty("value", companies[1].name)); expect(screen.queryByText("Rua original, 001")).toBeNull();
  });
  it("retries only GET after a committed update whose refresh failed", async () => {
    vi.mocked(fetchCompanyDetails).mockResolvedValueOnce(details).mockRejectedValueOnce(new ApiError("network")).mockResolvedValue(details);
    const { user } = await ready(); await user.type(screen.getByLabelText(/^Razão social/), " nova"); await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByRole("alert")).toBeDefined(); expect(saveCompanyInformation).toHaveBeenCalledOnce(); await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(fetchCompanyDetails).toHaveBeenCalledTimes(3)); expect(saveCompanyInformation).toHaveBeenCalledOnce();
  });
});
