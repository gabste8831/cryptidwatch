import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../lib/auth.jsx';
import { SunsetScene } from '../components/Art.jsx';

// Só aceita voltar para caminhos internos (evita open redirect: ?voltar=https://site-malicioso).
function safeReturn(path) {
  return path && path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

export default function Auth({ mode }) {
  const isRegister = mode === 'register';
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      if (isRegister) await register(form.name, form.email, form.password);
      else await login(form.email, form.password);
      navigate(safeReturn(params.get('voltar')), { replace: true });
    } catch (err) {
      setError(err.details?.[0]?.mensagem ?? err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-art">
        <SunsetScene />
        <div className="auth-art-text">
          <div className="hud">Acesso ao arquivo</div>
          <div className="display" style={{ fontSize: 'clamp(40px, 6vw, 72px)' }}>
            {isRegister ? 'Vire testemunha' : 'De volta à trilha'}
          </div>
        </div>
      </div>
      <div className="auth-form">
        <div>
          <h1 className="display" style={{ fontSize: 44, marginBottom: 8 }}>{isRegister ? 'Criar conta' : 'Entrar'}</h1>
          <p className="dim" style={{ marginTop: 0 }}>
            {isRegister ? 'Para reportar avistamentos e deixar depoimentos.' : 'Use seu e-mail e senha.'}
          </p>
          <form className="form-grid" onSubmit={submit}>
            {isRegister && (
              <div className="field">
                <label htmlFor="name">Nome ou apelido</label>
                <input id="name" className="input" required minLength={2} maxLength={80} autoComplete="nickname"
                  value={form.name} onChange={set('name')} />
              </div>
            )}
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input id="email" type="email" className="input" required maxLength={254} autoComplete="email"
                value={form.email} onChange={set('email')} placeholder="voce@exemplo.com" />
            </div>
            <div className="field">
              <label htmlFor="password">Senha</label>
              <input id="password" type="password" className="input" required minLength={isRegister ? 10 : 1} maxLength={128}
                autoComplete={isRegister ? 'new-password' : 'current-password'} value={form.password} onChange={set('password')} />
              {isRegister && <span className="field-hint">Mínimo de 10 caracteres.</span>}
            </div>
            {error && <div className="alert" role="alert">{error}</div>}
            <button className="btn btn-primary" disabled={sending}>{sending ? 'Aguarde…' : isRegister ? 'Criar conta' : 'Entrar'}</button>
          </form>
          <p className="dim" style={{ marginTop: 24 }}>
            {isRegister
              ? <>Já tem conta? <Link to="/entrar" style={{ color: 'var(--sun-2)' }}>Entrar</Link></>
              : <>Primeira vez aqui? <Link to="/cadastro" style={{ color: 'var(--sun-2)' }}>Criar conta</Link></>}
          </p>
        </div>
      </div>
    </div>
  );
}
