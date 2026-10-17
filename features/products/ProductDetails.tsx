import type { Product } from "./schemas";
import { currency, typeLabels } from "./schemas";
import styles from "./products.module.scss";

const date = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
function imageUrl(value: string): string | undefined { try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined; } catch { return undefined; } }
export function ProductDetails({ product }: { product: Product }) {
  return <div className={styles.form}>
    <h3>{product.name}</h3><p className={styles.description}>{product.description || "Sem descrição."}</p>
    <dl className={styles.details}><dt>Categoria</dt><dd>{product.category?.name || "Categoria indisponível"}</dd><dt>Tipo</dt><dd>{typeLabels[product.type]}</dd><dt>Preço</dt><dd>{product.type === "VARIANT_WITH_PRICE" ? "Conforme a variação" : currency(product.price)}</dd><dt>Criado em</dt><dd><time dateTime={product.createdAt}>{date(product.createdAt)}</time></dd><dt>Atualizado em</dt><dd><time dateTime={product.updatedAt}>{date(product.updatedAt)}</time></dd></dl>
    {product.type !== "NORMAL" && <section><h3>Variações</h3>{product.variants.length ? <ul>{product.variants.map((variant) => <li key={variant.id}>{variant.name}{product.type === "VARIANT_WITH_PRICE" ? ` — ${currency(variant.price)}` : ""}</li>)}</ul> : <p>Nenhuma variação retornada.</p>}</section>}
    {!!product.images?.length && <section><h3>Imagens</h3><div className={styles.images}>{product.images.map((image) => {
      const url = imageUrl(image.url);
      // Existing external URLs only: no arbitrary Next image optimizer proxy/upload service.
      // eslint-disable-next-line @next/next/no-img-element
      return url ? <img key={image.id} src={url} alt={`Imagem de ${product.name}`} width={160} height={160} loading="lazy" referrerPolicy="no-referrer" /> : <p key={image.id}>Imagem indisponível.</p>;
    })}</div></section>}
  </div>;
}
