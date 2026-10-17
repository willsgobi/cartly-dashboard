import { Suspense } from "react";
import { ProductsWorkspace } from "../../../../features/products/ProductsWorkspace";
export default function ProductsPage() { return <Suspense fallback={<p role="status">Carregando produtos...</p>}><ProductsWorkspace /></Suspense>; }
