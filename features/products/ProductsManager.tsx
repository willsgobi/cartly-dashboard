"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useActiveCompany } from "../companies/ActiveCompanyContext";
import { fetchCategories } from "../categories/api";
import type { Category } from "../categories/schemas";
import { fetchProducts, productError } from "./api";
import { currency, productTypes, typeLabels, type Product } from "./schemas";
import { ProductDialog } from "./ProductDialog";
import { DeleteProductDialog } from "./DeleteProductDialog";
import styles from "./products.module.scss";

type Dialog = { mode: "create" } | { mode: "edit" | "details"; id: string } | { mode: "delete"; product: Product } | null;
export function ProductsManager() {
  const { activeCompany } = useActiveCompany();
  const companyId = activeCompany?.id;
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [categoryError, setCategoryError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => { if (success) createButton.current?.focus(); }, [success]);
  useEffect(() => {
    if (!companyId) return;
    const pending = new AbortController();
    void Promise.allSettled([fetchProducts(companyId, pending.signal), fetchCategories(companyId, pending.signal)]).then(([items, groups]) => {
      if (pending.signal.aborted) return;
      if (items.status === "fulfilled") setProducts(items.value); else { setProducts([]); setError(productError(items.reason)); }
      if (groups.status === "fulfilled") setCategories(groups.value); else { setCategories([]); setCategoryError(productError(groups.reason)); }
      setLoading(false);
    });
    return () => pending.abort();
  }, [companyId, revision]);
  function refresh() { setLoading(true); setError(undefined); setCategoryError(undefined); setRevision((value) => value + 1); }
  function complete(message: string) { setDialog(null); setSuccess(message); refresh(); }
  function open(next: Dialog) { setSuccess(undefined); setDialog(next); }
  const filtered = products.filter((product) => product.name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")) && (!categoryFilter || product.categoryId === categoryFilter) && (!typeFilter || product.type === typeFilter));
  if (!activeCompany) return <section className={styles.panel}><h2>Produtos</h2><p>Selecione uma empresa no cabeçalho para gerenciar seus produtos.</p></section>;
  return <section className={styles.panel} aria-label="Gestão de produtos">
    <div className={styles.toolbar}><div><h2>Produtos</h2><p>Gerencie seu catálogo.</p></div><Button ref={createButton} data-modal-fallback className={styles.compact} onClick={() => open({ mode: "create" })}>Novo produto</Button></div>
    {success && <p role="status" className={styles.success}>{success}</p>}
    <div className={styles.filters}><Input label="Buscar por nome" name="search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} /><div className={styles.field}><label htmlFor={`${id}-category`}>Categoria</label><select id={`${id}-category`} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">Todas as categorias</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div><div className={styles.field}><label htmlFor={`${id}-type`}>Tipo</label><select id={`${id}-type`} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">Todos os tipos</option>{productTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></div></div>
    {categoryError && <p role="alert" className={styles.error}>Não foi possível carregar as categorias. <Button className={styles.compact} variant="outline" onClick={refresh}>Tentar novamente</Button></p>}
    <div aria-busy={loading}>{loading && <p role="status">Carregando produtos...</p>}
      {error ? <div className={styles.form}><p role="alert" className={styles.error}>{error}</p><Button className={styles.compact} variant="outline" onClick={refresh}>Tentar novamente</Button></div>
        : !filtered.length ? (!loading && <div className={styles.empty}><h3>{products.length ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}</h3><p>{products.length ? "Ajuste os filtros para encontrar outros produtos." : "Use Novo produto para começar."}</p></div>)
        : <ul className={styles.list}>{filtered.map((product) => <li key={product.id} className={styles.product}><div><h3>{product.name}</h3><p>{product.category?.name || categories.find((category) => category.id === product.categoryId)?.name || "Categoria indisponível"}</p><p className={styles.hint}>{typeLabels[product.type]}</p></div><p className={styles.price}>{product.type === "VARIANT_WITH_PRICE" ? "Conforme a variação" : currency(product.price)}</p><div className={styles.actions}><Button className={styles.compact} variant="outline" disabled={loading} aria-label={`Detalhes de ${product.name}`} onClick={() => open({ mode: "details", id: product.id })}>Detalhes</Button><Button className={styles.compact} variant="outline" disabled={loading} aria-label={`Editar ${product.name}`} onClick={() => open({ mode: "edit", id: product.id })}>Editar</Button><Button className={styles.compact} variant="outline" disabled={loading} aria-label={`Excluir ${product.name}`} onClick={() => open({ mode: "delete", product })}>Excluir</Button></div></li>)}</ul>}
    </div>
    {dialog?.mode === "delete" ? <DeleteProductDialog companyId={activeCompany.id} product={dialog.product} onClose={() => setDialog(null)} onDeleted={() => complete("Produto excluído da listagem com sucesso.")} />
      : dialog && <ProductDialog companyId={activeCompany.id} mode={dialog.mode} productId={dialog.mode === "create" ? undefined : dialog.id} onClose={() => setDialog(null)} onSaved={() => complete(dialog.mode === "create" ? "Produto criado com sucesso." : "Produto atualizado com sucesso.")} />}
  </section>;
}
