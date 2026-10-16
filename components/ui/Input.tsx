"use client";

import { useId, type ComponentPropsWithRef } from "react";
import styles from "./Input.module.scss";

export type InputProps = ComponentPropsWithRef<"input"> & {
  label: string;
  error?: string;
};

export function Input({
  label,
  error,
  id,
  className,
  required,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const descriptionIds = [describedBy, error ? errorId : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        {...props}
        id={inputId}
        required={required}
        aria-invalid={error ? true : invalid}
        aria-describedby={descriptionIds || undefined}
        className={[styles.input, className].filter(Boolean).join(" ")}
      />
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
