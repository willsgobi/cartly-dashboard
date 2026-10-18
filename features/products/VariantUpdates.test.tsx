// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductDialog } from "./ProductDialog";
import { ActiveCompanyProvider } from "../companies/ActiveCompanyContext";
import { fetchProduct, patchVariant } from "./api";
import { product, company } from "./test-fixtures";
import { ApiError } from "../../lib/api/errors";
vi.mock("./api", async (original) => ({ ...await original<typeof import("./api")>(), fetchProduct: vi.fn(), patchVariant: vi.fn() }));
const current = { ...product, type: "VARIANT_WITH_PRICE" as const, price: null, variants: [{ id: "v", name: "Pequena", price: 10 }] };
const changed = vi.fn(); const close = vi.fn();
beforeEach(() => {
  vi.mocked(fetchProduct).mockReset().mockResolvedValue(current); vi.mocked(patchVariant).mockReset().mockResolvedValue();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
});
afterEach(cleanup);
const view = (scope = "a") => <ActiveCompanyProvider companies={[{ ...company, id: scope }]} activeCompany={{ ...company, id: scope }}><ProductDialog companyId={scope} productId="p" mode="details" onClose={close} onSaved={vi.fn()} onVariantsChanged={changed} /></ActiveCompanyProvider>;
async function edit() { render(view()); const user = userEvent.setup(); await user.click(await screen.findByRole("button", { name: "Editar variante Pequena" })); return user; }
describe("variant edit modal", () => {
  it("prefills fields, skips unchanged submission and restores focus", async () => {
    const user = await edit(); expect(screen.getByLabelText(/Nome da variante/)).toHaveProperty("value", "Pequena"); expect(screen.getByLabelText(/Preço da variante/)).toHaveProperty("value", "10"); expect(document.activeElement).toBe(screen.getByLabelText(/Nome da variante/));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" })); expect(patchVariant).not.toHaveBeenCalled(); expect(screen.queryByRole("dialog", { name: "Editar variante" })).toBeNull(); expect(document.activeElement).toBe(screen.getByRole("button", { name: "Editar variante Pequena" })); expect(close).not.toHaveBeenCalled();
  });
  it.each(["name", "price", "both"])("PATCHes only changed %s and refreshes details/list", async (field) => {
    const user = await edit(); if (field !== "price") { await user.clear(screen.getByLabelText(/Nome da variante/)); await user.type(screen.getByLabelText(/Nome da variante/), "Grande"); }
    if (field !== "name") { await user.clear(screen.getByLabelText(/Preço da variante/)); await user.type(screen.getByLabelText(/Preço da variante/), "45,50"); }
    vi.mocked(fetchProduct).mockResolvedValue({ ...current, variants: [{ id: "v", name: field === "price" ? "Pequena" : "Grande", price: field === "name" ? 10 : 45.5 }] });
    await user.click(screen.getByRole("button", { name: "Salvar alterações" })); expect(await screen.findByText("Variante atualizada com sucesso.")).toBeDefined();
    expect(patchVariant).toHaveBeenCalledExactlyOnceWith("a", "p", "v", { ...(field !== "price" ? { name: "Grande" } : {}), ...(field !== "name" ? { price: 45.5 } : {}) }, expect.any(AbortSignal)); expect(screen.queryByRole("dialog", { name: "Editar variante" })).toBeNull(); expect(changed).toHaveBeenCalledOnce();
  });
  it("never displays/submits price for shared-price variants", async () => {
    vi.mocked(fetchProduct).mockResolvedValue({ ...current, type: "VARIANT", price: 59.9, variants: [{ ...current.variants[0], price: null }] }); const user = await edit(); expect(screen.queryByLabelText(/Preço da variante/)).toBeNull(); await user.clear(screen.getByLabelText(/Nome da variante/)); await user.type(screen.getByLabelText(/Nome da variante/), "Grande"); await user.click(screen.getByRole("button", { name: "Salvar alterações" })); await waitFor(() => expect(patchVariant).toHaveBeenCalledWith("a", "p", "v", { name: "Grande" }, expect.any(AbortSignal)));
  });
  it("has no variant edit controls for NORMAL", async () => { vi.mocked(fetchProduct).mockResolvedValue(product); render(view()); await screen.findByText("Natural"); expect(screen.queryByRole("button", { name: /Editar variante/ })).toBeNull(); });
  it("validates blank names and invalid prices", async () => {
    const user = await edit(); await user.clear(screen.getByLabelText(/Nome da variante/)); await user.clear(screen.getByLabelText(/Preço da variante/)); await user.type(screen.getByLabelText(/Preço da variante/), "0"); await user.click(screen.getByRole("button", { name: "Salvar alterações" })); expect(await screen.findByText("Informe o nome da variante.")).toBeDefined(); expect(screen.getAllByRole("alert")).toHaveLength(2); expect(patchVariant).not.toHaveBeenCalled();
  });
  it.each([400, 401, 403, 404, 500])("preserves input and the edit modal on HTTP %s", async (status) => {
    vi.mocked(patchVariant).mockRejectedValue(new ApiError("http", { status })); const user = await edit(); await user.type(screen.getByLabelText(/Nome da variante/), " alterada"); await user.click(screen.getByRole("button", { name: "Salvar alterações" })); expect(await screen.findByRole("alert")).toBeDefined(); expect(screen.getByLabelText(/Nome da variante/)).toHaveProperty("value", "Pequena alterada"); expect(screen.getByRole("dialog", { name: "Editar variante" })).toBeDefined(); expect(close).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
  });
  it("Escape dismisses only the edit modal, preserving the product details", async () => {
    await edit(); fireEvent(screen.getByRole("dialog", { name: "Editar variante" }), new Event("cancel", { cancelable: true, bubbles: true })); expect(screen.queryByRole("dialog", { name: "Editar variante" })).toBeNull(); expect(screen.getByRole("dialog", { name: "Detalhes do produto" })).toBeDefined(); expect(close).not.toHaveBeenCalled();
  });
  it("blocks duplicates and prevents dismissal while PATCH is pending", async () => {
    vi.mocked(patchVariant).mockReturnValue(new Promise(() => {})); const user = await edit(); await user.type(screen.getByLabelText(/Nome da variante/), " alterada"); await user.dblClick(screen.getByRole("button", { name: "Salvar alterações" })); expect(patchVariant).toHaveBeenCalledOnce(); expect(within(screen.getByRole("dialog", { name: "Editar variante" })).getByRole("button", { name: "Cancelar" })).toHaveProperty("disabled", true); fireEvent(screen.getByRole("dialog", { name: "Editar variante" }), new Event("cancel", { cancelable: true, bubbles: true })); expect(screen.getByRole("dialog", { name: "Editar variante" })).toBeDefined(); expect(close).not.toHaveBeenCalled();
  });
  it("closes on company teardown, aborts PATCH and ignores its late success", async () => {
    let resolve!: () => void; vi.mocked(patchVariant).mockReturnValue(new Promise((done) => { resolve = done; })); const rendered = render(view()); const user = userEvent.setup(); await user.click(await screen.findByRole("button", { name: "Editar variante Pequena" })); await user.type(screen.getByLabelText(/Nome da variante/), " alterada"); await user.click(screen.getByRole("button", { name: "Salvar alterações" })); const signal = vi.mocked(patchVariant).mock.calls[0][4]; rendered.rerender(view("b")); expect(signal.aborted).toBe(true); expect(screen.queryByRole("dialog", { name: "Editar variante" })).toBeNull(); await act(async () => { resolve(); }); expect(changed).not.toHaveBeenCalled();
  });
  it("does not replay a successful PATCH if detail refresh fails", async () => {
    const user = await edit(); await user.type(screen.getByLabelText(/Nome da variante/), " alterada"); vi.mocked(fetchProduct).mockRejectedValue(new ApiError("network")); await user.click(screen.getByRole("button", { name: "Salvar alterações" })); expect(await screen.findByText("Variante atualizada com sucesso.")).toBeDefined(); expect(await screen.findByRole("alert")).toBeDefined(); await user.click(screen.getByRole("button", { name: "Tentar novamente" })); expect(patchVariant).toHaveBeenCalledOnce(); expect(screen.queryByRole("dialog", { name: "Editar variante" })).toBeNull();
  });
});
