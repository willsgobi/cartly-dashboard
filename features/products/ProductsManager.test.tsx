// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductsManager } from "./ProductsManager";
import { ActiveCompanyProvider } from "../companies/ActiveCompanyContext";
import { fetchCategories } from "../categories/api";
import { fetchProduct, fetchProducts, saveProduct, removeProduct } from "./api";
import { ApiError } from "../../lib/api/errors";
import { product, company, categories } from "./test-fixtures";
vi.mock("../categories/api", () => ({ fetchCategories: vi.fn() }));
vi.mock("./api", async (original) => ({ ...await original<typeof import("./api")>(), fetchProducts: vi.fn(), fetchProduct: vi.fn(), saveProduct: vi.fn(), removeProduct: vi.fn() }));
beforeEach(() => {
  vi.mocked(fetchCategories).mockReset().mockResolvedValue(categories); vi.mocked(fetchProducts).mockReset().mockResolvedValue([product]); vi.mocked(fetchProduct).mockReset().mockResolvedValue(product); vi.mocked(saveProduct).mockReset().mockResolvedValue(); vi.mocked(removeProduct).mockReset().mockResolvedValue();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
});
afterEach(cleanup);
const manager = () => <ActiveCompanyProvider companies={[company]} activeCompany={company}><ProductsManager /></ActiveCompanyProvider>;
async function ready() { render(manager()); await screen.findByRole("button", { name: "Editar Suco" }); return userEvent.setup(); }
async function openCreate() { const user = await ready(); await user.click(screen.getByRole("button", { name: "Novo produto" })); await screen.findByLabelText(/Nome do produto/); return user; }
async function fill(user: ReturnType<typeof userEvent.setup>) { await user.type(screen.getByLabelText(/Nome do produto/), "  Café  "); await user.type(screen.getByLabelText("Descrição"), "Natural"); await user.selectOptions(within(screen.getByRole("dialog")).getByLabelText(/Categoria/), "cat"); await user.type(screen.getByLabelText(/Preço/), "12,50"); }
describe("products management", () => {
  it("shows API data and BRL prices and filters locally", async () => {
    const user = await ready(); expect(screen.getByText(/12,50/)).toBeDefined(); await user.type(screen.getByLabelText("Buscar por nome"), "inexistente"); expect(screen.getByText("Nenhum produto encontrado")).toBeDefined();
    await user.clear(screen.getByLabelText("Buscar por nome")); await user.selectOptions(screen.getByLabelText("Tipo"), "VARIANT"); expect(screen.getByText("Nenhum produto encontrado")).toBeDefined(); expect(fetchProducts).toHaveBeenCalledOnce();
    await user.selectOptions(screen.getByLabelText("Tipo"), ""); await user.selectOptions(screen.getByLabelText("Categoria"), "cat"); expect(screen.getByText("Suco")).toBeDefined();
  });
  it("waits for an active company before reading data", () => { render(<ActiveCompanyProvider companies={[company]} activeCompany={null}><ProductsManager /></ActiveCompanyProvider>); expect(screen.getByText(/Selecione uma empresa/)).toBeDefined(); expect(fetchProducts).not.toHaveBeenCalled(); });
  it("shows empty and retries failed lists", async () => {
    vi.mocked(fetchProducts).mockRejectedValueOnce(new ApiError("network")).mockResolvedValue([]); render(manager()); expect(await screen.findByRole("alert")).toBeDefined(); await userEvent.setup().click(screen.getByRole("button", { name: "Tentar novamente" })); expect(await screen.findByText("Nenhum produto cadastrado")).toBeDefined();
  });
  it("validates required fields and creates a numeric NORMAL payload without variants", async () => {
    const user = await openCreate(); await user.click(screen.getByRole("button", { name: "Criar produto" })); expect(await screen.findByText("Informe o nome do produto.")).toBeDefined(); expect(saveProduct).not.toHaveBeenCalled();
    await fill(user); await user.click(screen.getByRole("button", { name: "Criar produto" })); expect(await screen.findByText("Produto criado com sucesso.")).toBeDefined(); expect(saveProduct).toHaveBeenCalledExactlyOnceWith("a", { name: "Café", description: "Natural", categoryId: "cat", type: "NORMAL", price: 12.5 }, undefined, expect.any(AbortSignal)); expect(fetchProducts).toHaveBeenCalledTimes(2);
  });
  it("requires categories and offers existing category management", async () => {
    vi.mocked(fetchCategories).mockResolvedValue([]); const user = await openCreate(); expect(screen.getByRole("link", { name: "Gerenciar categorias" }).getAttribute("href")).toBe("/dashboard/categories"); await user.click(screen.getByRole("button", { name: "Criar produto" })); expect(saveProduct).not.toHaveBeenCalled();
  });
  it("preserves inputs on 403 and prevents duplicate requests while pending", async () => {
    let reject!: (error: unknown) => void; vi.mocked(saveProduct).mockReturnValue(new Promise((_, fail) => { reject = fail; })); const user = await openCreate(); await fill(user); await user.dblClick(screen.getByRole("button", { name: "Criar produto" })); expect(saveProduct).toHaveBeenCalledOnce(); expect(screen.getByRole("button", { name: "Fechar diálogo" })).toHaveProperty("disabled", true);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true })); expect(screen.getByRole("dialog")).toBeDefined();
    reject(new ApiError("http", { status: 403 })); expect(await screen.findByRole("alert")).toBeDefined(); expect(screen.getByLabelText(/Nome do produto/)).toHaveProperty("value", "  Café  ");
  });
  it("loads detail before editing, skips unchanged fields and PATCHes only changes", async () => {
    const user = await ready(); await user.click(screen.getByRole("button", { name: "Editar Suco" })); await screen.findByLabelText(/Nome do produto/); await user.click(screen.getByRole("button", { name: "Salvar alterações" })); expect(saveProduct).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Editar Suco" })); await screen.findByLabelText(/Nome do produto/); await user.clear(screen.getByLabelText(/Nome do produto/)); await user.type(screen.getByLabelText(/Nome do produto/), "Suco novo"); await user.click(screen.getByRole("button", { name: "Salvar alterações" })); expect(await screen.findByText("Produto atualizado com sucesso.")).toBeDefined(); expect(saveProduct).toHaveBeenCalledWith("a", { name: "Suco novo" }, "p", expect.any(AbortSignal));
  });
  it.each(["VARIANT", "VARIANT_WITH_PRICE"] as const)("displays existing %s details without variant controls", async (type) => {
    vi.mocked(fetchProduct).mockResolvedValue({ ...product, type, price: type === "VARIANT" ? 12.5 : null, description: null, variants: [{ id: "v", name: "Pequeno", price: type === "VARIANT" ? null : 7.5 }], images: [{ id: "i", url: "javascript:alert(1)" }] });
    const user = await ready(); await user.click(screen.getByRole("button", { name: "Detalhes de Suco" })); expect(await screen.findByText(/Pequeno/)).toBeDefined(); expect(screen.getByText("Sem descrição.")).toBeDefined(); expect(screen.getByText("Imagem indisponível.")).toBeDefined(); if (type === "VARIANT_WITH_PRICE") expect(screen.getByText(/7,50/)).toBeDefined(); expect(screen.queryByRole("button", { name: /variação/i })).toBeNull();
  });
  it("blocks editing inconsistent variants", async () => {
    vi.mocked(fetchProduct).mockResolvedValue({ ...product, type: "VARIANT", variants: [] }); const user = await ready(); await user.click(screen.getByRole("button", { name: "Editar Suco" })); expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("gerenciar suas variantes")); expect(screen.queryByRole("button", { name: "Salvar alterações" })).toBeNull();
  });
  it("edits variant product metadata without sending prices, type or variant changes", async () => {
    vi.mocked(fetchProduct).mockResolvedValue({ ...product, type: "VARIANT_WITH_PRICE", price: null, variants: [{ id: "v", name: "P", price: 5 }] });
    const user = await ready(); await user.click(screen.getByRole("button", { name: "Editar Suco" })); await screen.findByLabelText(/Nome do produto/);
    expect(screen.queryByLabelText(/Preço/)).toBeNull(); expect(within(screen.getByRole("dialog")).getByLabelText("Tipo")).toHaveProperty("readOnly", true);
    await user.clear(screen.getByLabelText(/Nome do produto/)); await user.type(screen.getByLabelText(/Nome do produto/), "Produto com variação"); await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByText("Produto atualizado com sucesso.")).toBeDefined(); expect(saveProduct).toHaveBeenCalledWith("a", { name: "Produto com variação" }, "p", expect.any(AbortSignal));
  });
  it("shows only safe HTTP images and preserves metadata in details", async () => {
    vi.mocked(fetchProduct).mockResolvedValue({ ...product, images: [{ id: "i", url: "https://images.example.test/photo.jpg" }] });
    const user = await ready(); await user.click(screen.getByRole("button", { name: "Detalhes de Suco" }));
    expect(await screen.findByRole("img", { name: "Imagem de Suco" })).toHaveProperty("src", "https://images.example.test/photo.jpg");
    expect(screen.getByText("Criado em")).toBeDefined(); expect(screen.getByText("Atualizado em")).toBeDefined();
  });
  it("handles missing detail 404 with retry", async () => {
    vi.mocked(fetchProduct).mockRejectedValueOnce(new ApiError("http", { status: 404 })); const user = await ready(); await user.click(screen.getByRole("button", { name: "Detalhes de Suco" })); expect(await screen.findByRole("alert")).toBeDefined(); await user.click(screen.getByRole("button", { name: "Tentar novamente" })); expect(await screen.findByText("Natural")).toBeDefined();
  });
  it("confirms soft deletion, preserves linked data and refreshes once", async () => {
    const user = await ready(); await user.click(screen.getByRole("button", { name: "Excluir Suco" })); expect(screen.getByRole("dialog").textContent).toContain("registros relacionados serão preservados"); expect(removeProduct).not.toHaveBeenCalled(); await user.click(screen.getByRole("button", { name: "Excluir produto" })); expect(await screen.findByText("Produto excluído da listagem com sucesso.")).toBeDefined(); expect(removeProduct).toHaveBeenCalledExactlyOnceWith("a", "p", expect.any(AbortSignal));
  });
  it("clears filters/dialog/data and aborts work on company change", async () => {
    const view = render(manager()); await screen.findByText("Suco"); await userEvent.setup().click(screen.getByRole("button", { name: "Editar Suco" })); await screen.findByLabelText(/Nome do produto/);
    const signal = vi.mocked(fetchProducts).mock.calls[0][1]; vi.mocked(fetchProducts).mockResolvedValue([]);
    view.rerender(<ActiveCompanyProvider companies={[{ ...company, id: "b" }]} activeCompany={{ ...company, id: "b" }}><ProductsManager /></ActiveCompanyProvider>); expect(signal.aborted).toBe(true); expect(screen.queryByRole("dialog")).toBeNull(); expect(screen.queryByText("Suco")).toBeNull(); await waitFor(() => expect(fetchProducts).toHaveBeenLastCalledWith("b", expect.any(AbortSignal)));
  });
  it("blocks duplicate deletion and keeps the confirmation on errors", async () => {
    let reject!: (error: unknown) => void; vi.mocked(removeProduct).mockReturnValue(new Promise((_, fail) => { reject = fail; }));
    const user = await ready(); await user.click(screen.getByRole("button", { name: "Excluir Suco" })); await user.dblClick(screen.getByRole("button", { name: "Excluir produto" })); expect(removeProduct).toHaveBeenCalledOnce(); expect(screen.getByRole("button", { name: "Cancelar" })).toHaveProperty("disabled", true);
    reject(new ApiError("http", { status: 403 })); expect(await screen.findByRole("alert")).toBeDefined(); expect(screen.getByRole("dialog")).toBeDefined(); expect(fetchProducts).toHaveBeenCalledOnce();
  });
  it("never repeats a committed mutation when list refresh fails", async () => {
    const user = await ready(); vi.mocked(fetchProducts).mockRejectedValue(new ApiError("network")); await user.click(screen.getByRole("button", { name: "Excluir Suco" })); await user.click(screen.getByRole("button", { name: "Excluir produto" }));
    expect(await screen.findByText("Produto excluído da listagem com sucesso.")).toBeDefined(); expect(await screen.findByRole("alert")).toBeDefined(); await user.click(screen.getByRole("button", { name: "Tentar novamente" })); expect(removeProduct).toHaveBeenCalledOnce();
  });
});
