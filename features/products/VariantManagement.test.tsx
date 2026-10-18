// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductForm } from "./ProductForm";
import { ProductDialog } from "./ProductDialog";
import { ActiveCompanyProvider } from "../companies/ActiveCompanyContext";
import { fetchCategories } from "../categories/api";
import { addVariant, fetchProduct, removeVariant, saveProduct } from "./api";
import { ApiError } from "../../lib/api/errors";
import { product, categories, company } from "./test-fixtures";
vi.mock("../categories/api", () => ({ fetchCategories: vi.fn() }));
vi.mock("./api", async (original) => ({ ...await original<typeof import("./api")>(), fetchProduct: vi.fn(), addVariant: vi.fn(), removeVariant: vi.fn(), saveProduct: vi.fn() }));
const existing = { ...product, type: "VARIANT_WITH_PRICE" as const, price: null, variants: [{ id: "v", name: "Pequena", price: 10 }, { id: "m", name: "Média", price: 20 }] };
const close = vi.fn(); const changed = vi.fn();
beforeEach(() => {
  vi.mocked(fetchCategories).mockReset().mockResolvedValue(categories); vi.mocked(fetchProduct).mockReset().mockResolvedValue(existing); vi.mocked(addVariant).mockReset().mockResolvedValue(); vi.mocked(removeVariant).mockReset().mockResolvedValue(); vi.mocked(saveProduct).mockReset().mockResolvedValue();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
});
afterEach(cleanup);
async function createForm() { render(<ProductForm companyId="a" categories={categories} onClose={close} onSaved={changed} onBusyChange={vi.fn()} />); const user = userEvent.setup(); await user.type(screen.getByLabelText(/Nome do produto/), "Camiseta"); await user.selectOptions(screen.getByLabelText(/Categoria/), "cat"); return user; }
const details = (id = "a") => <ActiveCompanyProvider companies={[{ ...company, id }]} activeCompany={{ ...company, id }}><ProductDialog companyId={id} productId="p" mode="details" onClose={close} onSaved={vi.fn()} onVariantsChanged={changed} /></ActiveCompanyProvider>;
async function openDetails() { render(details()); await screen.findByText("Pequena — R$ 10,00"); return userEvent.setup(); }
describe("dynamic initial variants", () => {
  it("requires a row, preserves stable row data on removal and sends shared-price nulls", async () => {
    const user = await createForm(); await user.selectOptions(screen.getByLabelText("Tipo"), "VARIANT"); await user.type(screen.getByLabelText(/Preço compartilhado/), "59,90"); await user.click(screen.getByRole("button", { name: "Criar produto" })); expect(await screen.findByText("Adicione pelo menos uma variante.")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Adicionar variante" })); await user.type(screen.getAllByLabelText(/Nome da variante/)[0], "P"); await user.click(screen.getByRole("button", { name: "Adicionar variante" })); await user.type(screen.getAllByLabelText(/Nome da variante/)[1], "M");
    const retainedId = screen.getAllByLabelText(/Nome da variante/)[1].id; await user.click(screen.getByRole("button", { name: "Remover variante 1" })); expect(screen.getByLabelText(/Nome da variante/)).toHaveProperty("value", "M"); expect(screen.getByLabelText(/Nome da variante/).id).toBe(retainedId);
    await user.click(screen.getByRole("button", { name: "Criar produto" })); await waitFor(() => expect(saveProduct).toHaveBeenCalledWith("a", { name: "Camiseta", categoryId: "cat", type: "VARIANT", price: 59.9, variants: [{ name: "M", price: null }] }, undefined, expect.any(AbortSignal)));
  });
  it("keeps variant data through type changes but normalizes hidden prices and omits NORMAL variants", async () => {
    const user = await createForm(); await user.selectOptions(screen.getByLabelText("Tipo"), "VARIANT_WITH_PRICE"); await user.click(screen.getByRole("button", { name: "Adicionar variante" })); await user.type(screen.getByLabelText(/Nome da variante/), "P"); await user.type(screen.getByLabelText(/Preço da variante/), "30,50");
    await user.selectOptions(screen.getByLabelText("Tipo"), "NORMAL"); expect(screen.getByText(/variantes preenchidas estão preservadas/)).toBeDefined(); expect(screen.queryByLabelText(/Nome da variante/)).toBeNull();
    await user.selectOptions(screen.getByLabelText("Tipo"), "VARIANT_WITH_PRICE"); expect(screen.getByLabelText(/Nome da variante/)).toHaveProperty("value", "P"); expect(screen.getByLabelText(/Preço da variante/)).toHaveProperty("value", "30,50");
    await user.click(screen.getByRole("button", { name: "Criar produto" })); await waitFor(() => expect(saveProduct).toHaveBeenCalledWith("a", { name: "Camiseta", categoryId: "cat", type: "VARIANT_WITH_PRICE", price: null, variants: [{ name: "P", price: 30.5 }] }, undefined, expect.any(AbortSignal)));
  });
  it("validates variant names and individual prices and preserves fields on failures", async () => {
    vi.mocked(saveProduct).mockRejectedValue(new ApiError("http", { status: 400 })); const user = await createForm(); await user.selectOptions(screen.getByLabelText("Tipo"), "VARIANT_WITH_PRICE"); await user.click(screen.getByRole("button", { name: "Adicionar variante" })); await user.click(screen.getByRole("button", { name: "Criar produto" })); expect(await screen.findByText("Informe o nome da variante.")).toBeDefined();
    await user.type(screen.getByLabelText(/Nome da variante/), "P"); await user.type(screen.getByLabelText(/Preço da variante/), "10,50"); await user.click(screen.getByRole("button", { name: "Criar produto" })); expect(await screen.findByRole("alert")).toBeDefined(); expect(screen.getByLabelText(/Nome da variante/)).toHaveProperty("value", "P");
  });
});
describe("existing variant management", () => {
  it("adds a variant, keeps details open and refreshes product and list", async () => {
    const user = await openDetails(); await user.click(screen.getByRole("button", { name: "Adicionar variante" })); expect(document.activeElement).toBe(screen.getByLabelText(/Nome da variante/)); await user.type(screen.getByLabelText(/Nome da variante/), "Grande"); await user.type(screen.getByLabelText(/Preço da variante/), "30,10");
    vi.mocked(fetchProduct).mockResolvedValue({ ...existing, variants: [...existing.variants, { id: "g", name: "Grande", price: 30.1 }] });
    await user.click(screen.getByRole("button", { name: "Salvar variante" })); expect(await screen.findByText("Variante adicionada com sucesso.")).toBeDefined(); expect(await screen.findByText("Grande — R$ 30,10")).toBeDefined(); expect(addVariant).toHaveBeenCalledWith("a", "p", { name: "Grande", price: 30.1 }, expect.any(AbortSignal)); expect(changed).toHaveBeenCalledOnce(); expect(close).not.toHaveBeenCalled();
  });
  it.each([403, 409])("preserves fields on HTTP %s", async (status) => {
    vi.mocked(addVariant).mockRejectedValue(new ApiError("http", { status })); const user = await openDetails(); await user.click(screen.getByRole("button", { name: "Adicionar variante" })); await user.type(screen.getByLabelText(/Nome da variante/), "Grande"); await user.type(screen.getByLabelText(/Preço da variante/), "30"); await user.click(screen.getByRole("button", { name: "Salvar variante" })); expect(await screen.findByRole("alert")).toBeDefined(); expect(screen.getByLabelText(/Nome da variante/)).toHaveProperty("value", "Grande"); if (status === 409) expect(screen.getByRole("alert").textContent).toContain("Já existe uma variante"); expect(changed).not.toHaveBeenCalled();
  });
  it("submits null for shared pricing and no controls for NORMAL", async () => {
    vi.mocked(fetchProduct).mockResolvedValue({ ...existing, type: "VARIANT", price: 20, variants: [{ id: "v", name: "Pequena", price: null }] }); render(details()); const user = userEvent.setup(); await user.click(await screen.findByRole("button", { name: "Adicionar variante" })); expect(screen.queryByLabelText(/Preço da variante/)).toBeNull(); await user.type(screen.getByLabelText(/Nome da variante/), "Grande"); await user.click(screen.getByRole("button", { name: "Salvar variante" })); await waitFor(() => expect(addVariant).toHaveBeenCalledWith("a", "p", { name: "Grande", price: null }, expect.any(AbortSignal)));
  });
  it("does not show variant controls for NORMAL", async () => { vi.mocked(fetchProduct).mockResolvedValue(product); render(details()); await screen.findByText("Natural"); expect(screen.queryByRole("button", { name: "Adicionar variante" })).toBeNull(); });
  it("confirms physical deletion and warns about the last variant without inventing a restriction", async () => {
    vi.mocked(fetchProduct).mockResolvedValue({ ...existing, variants: [existing.variants[0]] }); const user = await openDetails(); await user.click(screen.getByRole("button", { name: "Excluir variante Pequena" })); expect(screen.getByRole("group", { name: "Confirmar exclusão da variante" }).textContent).toContain("exclusão é permanente"); expect(screen.getByRole("alert").textContent).toContain("última variante"); expect(document.activeElement?.textContent).toBe("Cancelar"); expect(removeVariant).not.toHaveBeenCalled();
    vi.mocked(fetchProduct).mockResolvedValue({ ...existing, variants: [] }); await user.click(screen.getByRole("button", { name: "Excluir variante" })); expect(await screen.findByText("Variante excluída permanentemente.")).toBeDefined(); expect(await screen.findByText(/Este produto está sem variantes/)).toBeDefined(); expect(removeVariant).toHaveBeenCalledExactlyOnceWith("a", "p", "v", expect.any(AbortSignal)); expect(screen.getByRole("button", { name: "Adicionar variante" })).toBeDefined();
  });
  it("blocks duplicate deletion and keeps the parent modal locked", async () => {
    vi.mocked(removeVariant).mockReturnValue(new Promise(() => {})); const user = await openDetails(); await user.click(screen.getByRole("button", { name: "Excluir variante Pequena" })); await user.dblClick(screen.getByRole("button", { name: "Excluir variante" })); expect(removeVariant).toHaveBeenCalledOnce(); expect(screen.getByRole("button", { name: "Fechar diálogo" })).toHaveProperty("disabled", true); fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true })); expect(close).not.toHaveBeenCalled();
  });
  it("never replays a committed mutation if detail refresh fails", async () => {
    const user = await openDetails(); await user.click(screen.getByRole("button", { name: "Excluir variante Pequena" })); vi.mocked(fetchProduct).mockRejectedValue(new ApiError("network")); await user.click(screen.getByRole("button", { name: "Excluir variante" })); expect(await screen.findByText("Variante excluída permanentemente.")).toBeDefined(); expect(await screen.findByRole("alert")).toBeDefined(); await user.click(screen.getByRole("button", { name: "Tentar novamente" })); expect(removeVariant).toHaveBeenCalledOnce();
  });
  it("aborts pending mutations and drops variant forms on company change", async () => {
    vi.mocked(addVariant).mockReturnValue(new Promise(() => {})); const view = render(details()); const user = userEvent.setup(); await user.click(await screen.findByRole("button", { name: "Adicionar variante" })); await user.type(screen.getByLabelText(/Nome da variante/), "Grande"); await user.type(screen.getByLabelText(/Preço da variante/), "30"); await user.click(screen.getByRole("button", { name: "Salvar variante" })); const signal = vi.mocked(addVariant).mock.calls[0][3];
    view.rerender(details("b")); expect(signal.aborted).toBe(true); expect(screen.queryByLabelText(/Nome da variante/)).toBeNull(); expect(addVariant).toHaveBeenCalledOnce(); await waitFor(() => expect(fetchProduct).toHaveBeenLastCalledWith("b", "p", expect.any(AbortSignal)));
  });
});
