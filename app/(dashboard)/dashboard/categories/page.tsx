import { Suspense } from "react";
import { CategoriesWorkspace } from "../../../../features/categories/CategoriesWorkspace";

export default function CategoriesPage() {
  return <Suspense fallback={<p role="status">Carregando categorias...</p>}><CategoriesWorkspace /></Suspense>;
}
