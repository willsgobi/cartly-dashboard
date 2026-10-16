import type { ComponentPropsWithRef } from "react";
import styles from "./Button.module.scss";

export type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: "primary" | "secondary" | "outline";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  loading = false,
  disabled = false,
  type = "button",
  className,
  children,
  "aria-busy": busy,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || busy}
      className={[styles.button, styles[variant], className]
        .filter(Boolean)
        .join(" ")}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
      {loading && <span className={styles.srOnly}> — Carregando</span>}
    </button>
  );
}
