"use client";

import { useId } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Input } from "../../components/ui/Input";
import type { ProductFormValues } from "./schemas";
import styles from "./products.module.scss";

/** Shared fields for initial variant rows and the existing-product add form. */
export function VariantFields({ nameField, priceField, individualPrice, nameError, priceError, disabled = false }: { nameField: ReturnType<UseFormRegister<ProductFormValues>>; priceField?: ReturnType<UseFormRegister<ProductFormValues>>; individualPrice: boolean; nameError?: string; priceError?: string; disabled?: boolean }) {
  const id = useId();
  return <div className={styles.variantFields}><Input id={`${id}-name`} label="Nome da variante" required disabled={disabled} {...nameField} error={nameError} />{individualPrice && priceField && <Input id={`${id}-price`} label="Preço da variante (R$)" required inputMode="decimal" placeholder="0,00" disabled={disabled} {...priceField} error={priceError} />}</div>;
}

export function variantArrayError(errors: FieldErrors<ProductFormValues>): string | undefined { return errors.variants?.message ?? errors.variants?.root?.message; }
