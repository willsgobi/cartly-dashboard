// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ActiveCompanyProvider, useActiveCompany } from "./ActiveCompanyContext";
import { CompanySelector } from "./CompanySelector";

const companies = ["a", "b"].map((id) => ({ id, name: `Empresa ${id}`, document: id, createdAt: "now", updatedAt: "now" }));
afterEach(cleanup);

describe("company context and selection UI", () => {
  it("renders an explicit empty selection in HTML before hydration", () => {
    const html = renderToStaticMarkup(<ActiveCompanyProvider companies={companies} activeCompany={null}><CompanySelector /></ActiveCompanyProvider>);
    const page = new DOMParser().parseFromString(html, "text/html");
    expect(page.querySelector("select")?.value).toBe("");
  });
  it("renders the automatically selected single company without a redundant form", () => {
    render(<ActiveCompanyProvider companies={[companies[0]]} activeCompany={companies[0]}><CompanySelector /></ActiveCompanyProvider>);
    expect(screen.getByRole("status").textContent).toBe("Empresa a");
    expect(screen.queryByRole("combobox")).toBeNull();
  });
  it("lists names/documents and requires a choice for multiple companies", async () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
    render(<ActiveCompanyProvider companies={companies} activeCompany={null}><CompanySelector /></ActiveCompanyProvider>);
    expect(screen.getByRole("option", { name: "Empresa a — a" })).toBeDefined();
    expect(screen.getByRole("option", { name: "Empresa b — b" })).toBeDefined();
    const form = screen.getByRole("combobox").closest("form");
    if (!form) throw new Error("Missing selection form");
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Selecione uma empresa.");
    expect(screen.queryByRole("button")).toBeNull();
    expect(submit).not.toHaveBeenCalled();
  });
  it("submits a native POST for a full navigation and blocks duplicate switches", async () => {
    const user = userEvent.setup();
    const submit = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
    render(<ActiveCompanyProvider companies={companies} activeCompany={companies[0]}><CompanySelector /></ActiveCompanyProvider>);
    await user.selectOptions(screen.getByLabelText("Empresa"), "b");
    // A dropdown change alone cannot grant access or change the authoritative context.
    expect(screen.getByText("Empresa a")).toBeDefined();
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "a" } });
    expect(submit).toHaveBeenCalledOnce();
    const form = screen.getByRole("combobox").closest("form");
    expect(form?.getAttribute("method")).toBe("post");
    expect(form?.getAttribute("action")).toBe("/api/companies/active");
    expect(form?.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("combobox")).toHaveProperty("disabled", true);
    expect(screen.getByText("Alterando empresa...")).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("does not submit when the already active company is selected", async () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
    render(<ActiveCompanyProvider companies={companies} activeCompany={companies[0]}><CompanySelector /></ActiveCompanyProvider>);
    await userEvent.setup().selectOptions(screen.getByRole("combobox"), "a");
    expect(submit).not.toHaveBeenCalled();
  });
  it("unmounts company-local state and effect caches when the active scope changes", async () => {
    const cleaned = vi.fn();
    function ScopedData() {
      const { activeCompany } = useActiveCompany();
      const [cached, setCached] = useState("empty");
      useEffect(() => () => { cleaned(); }, []);
      return <button onClick={() => setCached("cached-for-a")}>{activeCompany?.id}:{cached}</button>;
    }
    const view = render(<ActiveCompanyProvider companies={companies} activeCompany={companies[0]}><ScopedData /></ActiveCompanyProvider>);
    await userEvent.setup().click(screen.getByRole("button"));
    expect(screen.getByRole("button").textContent).toBe("a:cached-for-a");
    view.rerender(<ActiveCompanyProvider companies={companies} activeCompany={companies[1]}><ScopedData /></ActiveCompanyProvider>);
    expect(screen.getByRole("button").textContent).toBe("b:empty");
    expect(cleaned).toHaveBeenCalledOnce();
  });
});
