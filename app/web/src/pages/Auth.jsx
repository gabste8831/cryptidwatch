import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../lib/auth.jsx';
import { OldPhotoScene } from '../components/Art.jsx';

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
    <div className="container auth-wrap">
      <div className="auth-art" aria-hidden="true">
        <figure className="old-photo" style={{ margin: 0 }}>
          <span className="tape tape-tr" />
          <div className="frame"><OldPhotoScene /></div>
          <figcaption className="caption hand">{isRegister ? "toda testemunha começa assim" : "de volta à trilha"}</figcaption>
        </figure>
      </div>
      <div className="auth-form paper on-paper">
        <div>
          <p className="label" style={{ margin: 0 }}>acesso restrito ao arquivo</p>
          <h1 className="display" style={{ fontSize: 38, margin: "6px 0 8px" }}>{isRegister ? 'Criar conta' : 'Entrar'}</h1>
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
              ? <>Já tem conta? <Link to="/entrar" className="blood">Entrar</Link></>
              : <>Primeira vez aqui? <Link to="/cadastro" className="blood">Criar conta</Link></>}
          </p>
        </div>
      </div>
    </div>
  );
}
