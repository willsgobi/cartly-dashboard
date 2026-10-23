import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import styles from "./page.module.scss";

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.brand}>Venduzily</p>
        <h1>Componentes de interface</h1>
        <p>Demonstração visual da base do painel administrativo.</p>
      </header>

      <section className={styles.card} aria-labelledby="buttons-title">
        <h2 id="buttons-title">Botões</h2>
        <p>Variações de aparência, disponibilidade e carregamento.</p>
        <div className={styles.buttons}>
          <Button>Primário</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="outline">Contorno</Button>
        </div>
        <div className={styles.buttons}>
          <Button disabled>Primário desabilitado</Button>
          <Button variant="secondary" disabled>Secundário desabilitado</Button>
          <Button variant="outline" disabled>Contorno desabilitado</Button>
        </div>
        <div className={styles.buttons}>
          <Button loading>Primário</Button>
          <Button variant="secondary" loading>Secundário</Button>
          <Button variant="outline" loading>Contorno</Button>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="inputs-title">
        <h2 id="inputs-title">Campos de entrada</h2>
        <p>Exemplos de rótulo, preenchimento obrigatório, erro e campo desabilitado.</p>
        <div className={styles.inputs}>
          <Input label="Nome" name="name" placeholder="Digite um nome" />
          <Input label="E-mail obrigatório" name="email" type="email" placeholder="nome@exemplo.com" required />
          <Input label="E-mail com erro" name="invalidEmail" type="email" defaultValue="exemplo" error="Informe um e-mail válido." />
          <Input label="Campo desabilitado" name="disabledExample" defaultValue="Indisponível" disabled />
        </div>
      </section>
    </main>
  );
}
