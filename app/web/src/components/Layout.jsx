import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { LogOut, Menu, Plus, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { LogoMark, WaxSeal } from './Art.jsx';

const REPO = 'https://github.com/gabste8831/cryptidwatch';

export function Layout() {
  const { user, isModerator, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [location.pathname]);

  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <Link to="/" className="logo" aria-label="CryptidWatch, início">
            <LogoMark className="logo-mark" />
            <span className="logo-word">CryptidWatch<span className="logo-sub">arquivo confidencial</span></span>
          </Link>

          <nav className={`nav${open ? ' open' : ''}`} aria-label="Principal">
            <NavLink to="/" end>Início</NavLink>
            <NavLink to="/casos">Arquivo</NavLink>
            <NavLink to="/ranking">Mais avistados</NavLink>
            {user && <NavLink to="/meus-casos">Meus casos</NavLink>}
            {isModerator && <NavLink to="/moderacao" className="inline-icon"><ShieldCheck size={15} /> Moderação</NavLink>}
          </nav>

          <div className="topbar-right">
            <Link to="/reportar" className="btn btn-primary btn-sm"><Plus size={16} /> Reportar</Link>
            {user ? (
              <span className="user-chip">
                <span className="user-name">{user.name}</span>
                {isModerator && <span className="badge-mod">mod</span>}
                <button type="button" className="btn btn-ghost icon-btn" aria-label="Sair"
                  onClick={async () => { await logout(); navigate('/'); }}>
                  <LogOut size={18} />
                </button>
              </span>
            ) : (
              <Link to="/entrar" className="btn btn-sm">Entrar</Link>
            )}
            <button type="button" className="btn btn-ghost icon-btn menu-toggle" aria-label={open ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <Link to="/" className="logo" aria-label="CryptidWatch, início">
              <WaxSeal className="wax footer-seal" title="CryptidWatch" />
              <span className="logo-word">CryptidWatch<span className="logo-sub">arquivo confidencial</span></span>
            </Link>
            <p>
              Central de relatos de avistamentos de criaturas que a ciência ainda não explica. Cada
              relato é lido, verificado e arquivado por um moderador antes de virar público.
            </p>
            <p className="hand footer-sign">o arquivo nunca fecha.</p>
          </div>

          <nav className="footer-col" aria-label="Arquivo">
            <h2>Arquivo</h2>
            <Link to="/">Início</Link>
            <Link to="/casos">Casos verificados</Link>
            <Link to="/ranking">Mais avistados</Link>
            <Link to="/reportar">Registrar relato</Link>
          </nav>

          <nav className="footer-col" aria-label="Sua conta">
            <h2>Sua pasta</h2>
            {user ? (
              <>
                <Link to="/meus-casos">Meus casos</Link>
                {isModerator && <Link to="/moderacao">Mesa de análise</Link>}
              </>
            ) : (
              <>
                <Link to="/entrar">Entrar</Link>
                <Link to="/cadastro">Criar conta</Link>
              </>
            )}
          </nav>

          <div className="footer-col">
            <h2>O projeto</h2>
            <a href={REPO} target="_blank" rel="noopener noreferrer">Código no GitHub</a>
            <a href={`${REPO}/tree/main/specs`} target="_blank" rel="noopener noreferrer">Especificações de segurança</a>
            <a href={`${REPO}/blob/main/docs/riscos-aceitos.md`} target="_blank" rel="noopener noreferrer">Riscos aceitos</a>
            <span className="footer-note">Auditoria e Segurança de Sistemas · UNIDAVI</span>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="container footer-bottom-inner">
            <span>© {new Date().getFullYear()} CryptidWatch. Projeto acadêmico.</span>
            <span>Relatos enviados pela comunidade. Nenhuma criatura foi ferida na produção deste arquivo.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
