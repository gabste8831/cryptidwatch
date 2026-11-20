import { Link } from 'react-router';

export function Loading({ label = 'Abrindo o arquivo…' }) {
  return (
    <div className="loading container" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="hud">{label}</span>
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  return (
    <div className="alert" role="alert">
      {error?.message || 'Não foi possível carregar.'}{' '}
      {onRetry && <button type="button" className="btn btn-sm btn-ghost" onClick={onRetry}>Tentar de novo</button>}
    </div>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <p className="display">{title}</p>
      {children && <p>{children}</p>}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}

export function NotFound() {
  return (
    <div className="container section">
      <Empty title="Arquivo não encontrado" action={<Link to="/casos" className="btn">Ver casos</Link>}>
        Esse caso não existe, ainda está em análise ou foi arquivado.
      </Empty>
    </div>
  );
}
