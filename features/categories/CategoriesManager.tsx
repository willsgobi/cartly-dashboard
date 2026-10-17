"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { useActiveCompany } from "../companies/ActiveCompanyContext";
import { categoryErrorMessage, fetchCategories } from "./api";
import { CategoryForm } from "./CategoryForm";
import { DeleteCategoryDialog } from "./DeleteCategoryDialog";
import type { Category } from "./schemas";
import styles from "./categories.module.scss";

type DialogState = { kind: "create" } | { kind: "edit" | "delete"; category: Category } | null;
const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

export function CategoriesManager() {
  const { activeCompany } = useActiveCompany();
  const companyId = activeCompany?.id;
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [dialog, setDialog] = useState<DialogState>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (success) createButton.current?.focus(); }, [success]);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!companyId) return;
    const pending = new AbortController();
    void fetchCategories(companyId, pending.signal)
      .then((result) => { if (!pending.signal.aborted) setCategories(result); })
      .catch((failure: unknown) => { if (!pending.signal.aborted) { setCategories([]); setError(categoryErrorMessage(failure)); } })
      .finally(() => { if (!pending.signal.aborted) setLoading(false); });
    return () => pending.abort();
  }, [companyId, revision]);
  function refresh() { setLoading(true); setError(undefined); setRevision((value) => value + 1); }
  function completed(message: string) { setDialog(null); setSuccess(message); refresh(); }
  if (!activeCompany) return <section className={styles.panel}><h2>Categorias</h2><p>Selecione uma empresa no cabeçalho para gerenciar suas categorias.</p></section>;
  return <section className={styles.panel} aria-label="Gestão de categorias">
    <div className={styles.toolbar}><div><h2>Categorias</h2><p>Gerencie suas categorias.</p></div><Button ref={createButton} className={styles.compactButton} data-modal-fallback onClick={() => { setSuccess(undefined); setDialog({ kind: "create" }); }}>Nova categoria</Button></div>
    <p className={styles.hint}>As operações dependem das suas permissões na empresa. A exclusão é restrita a administradores.</p>
    {success && <p role="status" className={styles.success}>{success}</p>}
    <div aria-busy={loading}>
      {loading && <p role="status">Carregando categorias...</p>}
      {error ? <div className={styles.feedback}><p role="alert" className={styles.error}>{error}</p><Button variant="outline" onClick={() => void refresh()}>Tentar novamente</Button></div>
        : !categories.length ? (!loading && <div className={styles.empty}><h3>Nenhuma categoria cadastrada</h3><p>Use Nova categoria para cadastrar sua primeira categoria.</p></div>)
        : <div className={styles.tableScroll}><table className={styles.table}><caption>Categorias cadastradas</caption><thead><tr><th scope="col">Nome</th><th scope="col">Criada em</th><th scope="col">Ações</th></tr></thead><tbody>{categories.map((category) => <tr key={category.id}><th scope="row">{category.name}</th><td><time dateTime={category.createdAt}>{dateFormat.format(new Date(category.createdAt))}</time></td><td><div className={styles.actions}><Button className={styles.compactButton} variant="outline" disabled={loading} aria-label={`Editar ${category.name}`} onClick={() => { setSuccess(undefined); setDialog({ kind: "edit", category }); }}>Editar</Button><Button className={styles.compactButton} variant="outline" disabled={loading} aria-label={`Excluir ${category.name}`} onClick={() => { setSuccess(undefined); setDialog({ kind: "delete", category }); }}>Excluir</Button></div></td></tr>)}</tbody></table></div>}
    </div>
    {dialog?.kind === "create" && <CategoryForm companyId={activeCompany.id} onClose={() => setDialog(null)} onSaved={() => completed("Categoria criada com sucesso.")} />}
    {dialog?.kind === "edit" && <CategoryForm companyId={activeCompany.id} category={dialog.category} onClose={() => setDialog(null)} onSaved={() => completed("Categoria atualizada com sucesso.")} />}
    {dialog?.kind === "delete" && <DeleteCategoryDialog companyId={activeCompany.id} category={dialog.category} onClose={() => setDialog(null)} onDeleted={() => completed("Categoria excluída com sucesso.")} />}
  </section>;
}
