import type { ReactNode } from 'react';
import Link from 'next/link';
import { Navigation } from '../../components/Navigation';
import { requireAdmin } from '../../auth/server';
import { logout, selectOrganization } from '../../auth/actions';

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const context = await requireAdmin();
  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/">AEX<span>Administração</span></Link>
      <p className="nav-label">ACOMPANHAMENTO</p>
      <Navigation />
      <Link className="invite-link" href="/convites">Convidar administrador</Link>
      <div className="sidebar-note"><strong>Educação digital</strong><p>Projeto acadêmico<br />Grupo G9 · Poli USP</p></div>
    </aside>
    <div className="workspace">
      <div className="topbar"><span>Painel de acompanhamento educativo</span><span className="demo-badge">Dados demonstrativos</span></div>
      <div className="account-bar">
        <span><strong>{context.me.profile.display_name}</strong> · {context.organization.name}</span>
        {context.organizations.length > 1 && <form action={selectOrganization} className="organization-form">
          <label htmlFor="organization">Organização</label><select id="organization" name="organization" defaultValue={context.organization.id}>
            {context.organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
          </select><button>Selecionar</button>
        </form>}
        <form action={logout}><button className="secondary-button">Sair da conta</button></form>
      </div>
      <div className="demo-notice"><strong>Ambiente de demonstração.</strong> Participantes e respostas são fictícios. Este painel não recebe os dados salvos no aplicativo mobile.</div>
      <main id="conteudo" tabIndex={-1}>{children}</main>
      <footer>AEX · Resultados educativos ilustrativos. Nenhum dado foi coletado de participantes reais.</footer>
    </div>
  </div>;
}
