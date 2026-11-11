import Link from 'next/link';
import type { ReactNode } from 'react';
export function AuthFrame({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main id="conteudo" className="auth-page" tabIndex={-1}>
    <section className="auth-card">
      <Link className="auth-brand" href="/login">AEX <span>Administração</span></Link>
      <header className="page-heading"><h1>{title}</h1><p>{description}</p></header>
      {children}
    </section>
  </main>;
}
