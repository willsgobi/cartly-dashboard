// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoriesManager } from "./CategoriesManager";
import { fetchCategories, removeCategory, saveCategory } from "./api";
import { ActiveCompanyProvider } from "../companies/ActiveCompanyContext";
import { ApiError } from "../../lib/api/errors";
vi.mock("./api", async (original) => ({ ...await original<typeof import("./api")>(), fetchCategories: vi.fn(), saveCategory: vi.fn(), removeCategory: vi.fn() }));
const company = { id: "a", name: "Empresa A", document: "a", createdAt: "now", updatedAt: "now" };
const category = { id: "c", name: "Bebidas", companyId: "a", createdAt: "2026-10-17T12:00:00Z", updatedAt: "2026-10-17T12:00:00Z" };
beforeEach(() => {
  vi.mocked(fetchCategories).mockReset().mockResolvedValue([category]); vi.mocked(saveCategory).mockReset().mockResolvedValue(); vi.mocked(removeCategory).mockReset().mockResolvedValue();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
});
afterEach(cleanup);
function manager(active = true) { return <ActiveCompanyProvider companies={[company]} activeCompany={active ? company : null}><CategoriesManager /></ActiveCompanyProvider>; }
async function ready() { render(manager()); await screen.findByRole("button", { name: "Editar Bebidas" }); return userEvent.setup(); }

describe("categories CRUD", () => {
  it("shows company-scoped names/dates and permission-neutral actions", async () => {
    await ready(); expect(screen.getByRole("table").textContent).toContain("17/10/2026");
    expect(screen.getByRole("caption").textContent).toBe("Categorias cadastradas"); expect(fetchCategories).toHaveBeenCalledWith("a", expect.any(AbortSignal));
  });
  it("does not request data before a company is selected", () => {
    render(manager(false)); expect(screen.getByText(/Selecione uma empresa/)).toBeDefined(); expect(fetchCategories).not.toHaveBeenCalled();
  });
  it("shows loading, empty and a create entry point", async () => {
    let resolve!: (value: typeof category[]) => void;
    vi.mocked(fetchCategories).mockReturnValue(new Promise((done) => { resolve = done; }));
    render(manager()); expect(screen.getByRole("status").textContent).toBe("Carregando categorias...");
    resolve([]); expect(await screen.findByText("Nenhuma categoria cadastrada")).toBeDefined(); expect(screen.getByRole("button", { name: "Nova categoria" })).toBeDefined();
  });
  it("retries list errors without exposing prior data", async () => {
    vi.mocked(fetchCategories).mockRejectedValueOnce(new ApiError("network")); render(manager());
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Não foi possível conectar ao servidor. Tente novamente.");
    await userEvent.setup().click(screen.getByRole("button", { name: "Tentar novamente" })); expect(await screen.findByText("Bebidas")).toBeDefined();
  });
  it("validates required names, trims, creates, closes and refreshes once", async () => {
    const user = await ready(); await user.click(screen.getByRole("button", { name: "Nova categoria" }));
    expect(document.activeElement).toBe(screen.getByLabelText(/Nome da categoria/));
    await user.click(screen.getByRole("button", { name: "Criar categoria" })); expect(await screen.findByText("Informe o nome da categoria.")).toBeDefined(); expect(saveCategory).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/Nome da categoria/), "  Alimentos  "); await user.click(screen.getByRole("button", { name: "Criar categoria" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(saveCategory).toHaveBeenCalledExactlyOnceWith("a", { name: "Alimentos" }, undefined, expect.any(AbortSignal));
    expect(await screen.findByText("Categoria criada com sucesso.")).toBeDefined(); expect(fetchCategories).toHaveBeenCalledTimes(2);
  });
  it("prefills and skips unchanged edits", async () => {
    const user = await ready(); await user.click(screen.getByRole("button", { name: "Editar Bebidas" }));
    expect(screen.getByLabelText(/Nome da categoria/)).toHaveProperty("value", "Bebidas"); await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(screen.queryByRole("dialog")).toBeNull(); expect(saveCategory).not.toHaveBeenCalled();
  });
  it("updates the selected category and refreshes the list", async () => {
    const user = await ready(); await user.click(screen.getByRole("button", { name: "Editar Bebidas" }));
    await user.clear(screen.getByLabelText(/Nome da categoria/)); await user.type(screen.getByLabelText(/Nome da categoria/), "Sucos");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByText("Categoria atualizada com sucesso.")).toBeDefined(); expect(saveCategory).toHaveBeenCalledExactlyOnceWith("a", { name: "Sucos" }, "c", expect.any(AbortSignal));
  });
  it.each([400, 403, 404, 409, 500])("preserves form input and reports HTTP %s safely", async (status) => {
    vi.mocked(saveCategory).mockRejectedValue(new ApiError("http", { status }));
    const user = await ready(); await user.click(screen.getByRole("button", { name: "Nova categoria" })); await user.type(screen.getByLabelText(/Nome da categoria/), "Duplicada");
    await user.click(screen.getByRole("button", { name: "Criar categoria" })); expect(await screen.findByRole("alert")).toBeDefined(); expect(screen.getByLabelText(/Nome da categoria/)).toHaveProperty("value", "Duplicada");
    expect(screen.getByRole("dialog")).toBeDefined(); expect(fetchCategories).toHaveBeenCalledOnce();
    if (status === 409) expect(screen.getByRole("alert").textContent).toContain("Já existe uma categoria");
  });
  it("blocks duplicate create, cancellation and Escape while saving", async () => {
    let resolve!: () => void; vi.mocked(saveCategory).mockReturnValue(new Promise((done) => { resolve = done; }));
    const user = await ready(); await user.click(screen.getByRole("button", { name: "Nova categoria" })); await user.type(screen.getByLabelText(/Nome da categoria/), "Alimentos");
    await user.dblClick(screen.getByRole("button", { name: "Criar categoria" }));
    expect(saveCategory).toHaveBeenCalledOnce(); expect(screen.getByLabelText(/Nome da categoria/)).toHaveProperty("disabled", true);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true })); expect(screen.getByRole("dialog")).toBeDefined(); resolve(); await screen.findByText("Categoria criada com sucesso.");
  });
  it("requires explicit deletion confirmation and allows cancellation without requests", async () => {
    const user = await ready(); const trigger = screen.getByRole("button", { name: "Excluir Bebidas" }); await user.click(trigger);
    expect(screen.getByRole("dialog").textContent).toContain("Bebidas"); expect(screen.getByText(/Esta exclusão é permanente/)).toBeDefined();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancelar" })); expect(removeCategory).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancelar" })); expect(document.activeElement).toBe(trigger); expect(removeCategory).not.toHaveBeenCalled();
  });
  it("deletes once, closes, refreshes and displays success", async () => {
    const user = await ready(); await user.click(screen.getByRole("button", { name: "Excluir Bebidas" })); await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Excluir categoria" }));
    expect(await screen.findByText("Categoria excluída com sucesso.")).toBeDefined(); expect(removeCategory).toHaveBeenCalledExactlyOnceWith("a", "c", expect.any(AbortSignal)); expect(fetchCategories).toHaveBeenCalledTimes(2);
  });
  it("blocks repeated deletion and cancels the pending request on unmount", async () => {
    vi.mocked(removeCategory).mockReturnValue(new Promise(() => {}));
    const view = render(manager()); const actor = userEvent.setup(); await screen.findByText("Bebidas");
    await actor.click(screen.getByRole("button", { name: "Excluir Bebidas" })); await actor.dblClick(screen.getByRole("button", { name: "Excluir categoria" }));
    expect(removeCategory).toHaveBeenCalledOnce(); expect(screen.getByRole("button", { name: "Cancelar" })).toHaveProperty("disabled", true);
    const signal = vi.mocked(removeCategory).mock.calls[0][2]; view.unmount(); expect(signal?.aborted).toBe(true);
  });
  it.each([403, 404, 409])("keeps category and dialog after deletion HTTP %s", async (status) => {
    vi.mocked(removeCategory).mockRejectedValue(new ApiError("http", { status }));
    const user = await ready(); await user.click(screen.getByRole("button", { name: "Excluir Bebidas" })); await user.click(screen.getByRole("button", { name: "Excluir categoria" }));
    const alert = await screen.findByRole("alert"); if (status === 409) expect(alert.textContent).toContain("existem produtos vinculados");
    expect(screen.getByRole("dialog")).toBeDefined(); expect(screen.getByRole("button", { name: "Editar Bebidas" })).toBeDefined(); expect(fetchCategories).toHaveBeenCalledOnce();
  });
  it("discards company data/dialogs and cancels pending work on company switch", async () => {
    const view = render(manager()); const user = userEvent.setup(); await screen.findByText("Bebidas"); await user.click(screen.getByRole("button", { name: "Editar Bebidas" }));
    const oldSignal = vi.mocked(fetchCategories).mock.calls[0][1];
    vi.mocked(fetchCategories).mockResolvedValue([]);
    view.rerender(<ActiveCompanyProvider companies={[{ ...company, id: "b" }]} activeCompany={{ ...company, id: "b" }}><CategoriesManager /></ActiveCompanyProvider>);
    expect(oldSignal.aborted).toBe(true); expect(screen.queryByRole("dialog")).toBeNull(); expect(screen.queryByText("Bebidas")).toBeNull();
    await screen.findByText("Nenhuma categoria cadastrada"); expect(fetchCategories).toHaveBeenLastCalledWith("b", expect.any(AbortSignal));
  });
  it("retains committed success if list refresh fails without replaying a mutation", async () => {
    const user = await ready(); vi.mocked(fetchCategories).mockRejectedValue(new ApiError("network")); await user.click(screen.getByRole("button", { name: "Excluir Bebidas" })); await user.click(screen.getByRole("button", { name: "Excluir categoria" }));
    expect(await screen.findByText("Categoria excluída com sucesso.")).toBeDefined(); expect(await screen.findByRole("alert")).toBeDefined(); expect(screen.queryByRole("dialog")).toBeNull(); expect(removeCategory).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" })); expect(removeCategory).toHaveBeenCalledOnce();
  });
});
