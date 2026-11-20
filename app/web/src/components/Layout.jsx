import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { LogOut, Menu, Plus, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { LogoMark } from './Art.jsx';

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
                {isModerator && <span className="badge-mod">MOD</span>}
                <button type="button" className="btn btn-ghost icon-btn" aria-label="Sair"
                  onClick={async () => { await logout(); navigate('/'); }}>
                  <LogOut size={18} />
                </button>
              </span>
            ) : (
              <Link to="/entrar" className="btn btn-sm">Entrar</Link>
            )}
            <button type="button" className="btn btn-ghost icon-btn menu-toggle" aria-label="Menu" aria-expanded={open}
              onClick={() => setOpen((o) => !o)}>
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <span>CryptidWatch · arquivo de avistamentos</span>
          <span>Trabalho de Auditoria e Segurança de Sistemas · UNIDAVI</span>
        </div>
      </footer>
    </>
  );
}
