"use client";

import { useId, useState } from "react";
import { Input, type InputProps } from "./Input";
import { Button } from "./Button";
import styles from "./PasswordInput.module.scss";

export function PasswordInput(props: Omit<InputProps, "type">) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = props.id ?? generatedId;
  return (
    <div className={styles.field}>
      <Input {...props} id={inputId} type={visible ? "text" : "password"} />
      <Button variant="secondary" className={styles.toggle} disabled={props.disabled}
        aria-controls={inputId} aria-pressed={visible}
        aria-label={`${visible ? "Ocultar" : "Mostrar"} ${props.label.toLocaleLowerCase("pt-BR")}`}
        onClick={() => setVisible((current) => !current)}>
        {visible ? "Ocultar" : "Mostrar"}
      </Button>
    </div>
  );
}
