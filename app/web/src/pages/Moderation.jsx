import { useState } from 'react';
import { Link } from 'react-router';
import { Check, Eye, Trash2, Undo2, X } from 'lucide-react';
import { api, useApi } from '../lib/api.js';
import { caseNumber, formatDate, timeAgo } from '../lib/format.js';
import { StarsInput } from '../components/Stars.jsx';
import { useToast } from '../components/Toast.jsx';
import { Empty, ErrorBox, Loading } from '../components/States.jsx';

export default function Moderation() {
  const queue = useApi('/moderation/queue');
  const [tab, setTab] = useState('relatos');
  const q = queue.data;
  const tabs = [
    ['relatos', 'Relatos', q?.sightings.length],
    ['fotos', 'Evidências', q?.photos.length],
    ['comentarios', 'Depoimentos denunciados', q?.comments.length],
    ['auditoria', 'Auditoria', null],
  ];

  return (
    <div className="container">
      <div className="page-head">
        <span className="section-kicker hud">Acesso restrito · moderador</span>
        <h1 className="display section-title">Mesa de análise</h1>
      </div>
      <div className="tabs" role="tablist">
        {tabs.map(([key, label, count]) => (
          <button key={key} type="button" role="tab" className="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
            {label}{count ? <span className="count">{count}</span> : null}
          </button>
        ))}
      </div>
      {queue.loading && <Loading />}
      {queue.error && <ErrorBox error={queue.error} onRetry={queue.reload} />}
      {q && tab === 'relatos' && <SightingQueue items={q.sightings} onDone={queue.reload} />}
      {q && tab === 'fotos' && <PhotoQueue items={q.photos} onDone={queue.reload} />}
      {q && tab === 'comentarios' && <CommentQueue items={q.comments} onDone={queue.reload} />}
      {tab === 'auditoria' && <AuditLog />}
      <div style={{ height: 64 }} />
    </div>
  );
}

function useDecision(onDone) {
  const toast = useToast();
  return async (fn, msg) => {
    try {
      await fn();
      toast(msg);
      onDone();
    } catch (err) {
      toast(err.message);
    }
  };
}

function askReason() {
  const reason = window.prompt('Motivo (o autor vai ver):');
  return reason && reason.trim().length >= 3 ? reason.trim() : null;
}

function SightingQueue({ items, onDone }) {
  const decide = useDecision(onDone);
  const [stars, setStars] = useState({});
  if (!items.length) return <Empty title="Mesa limpa">Nenhum relato esperando análise.</Empty>;
  return items.map((s) => (
    <div key={s.id} className="queue-item">
      <div className="mono" style={{ color: 'var(--sun-2)' }}>{caseNumber(s.id)} · {s.cryptid.name} · {s.author.name}</div>
      <div className="case-title">{s.title}</div>
      <div className="hud dim">{s.city}/{s.uf} · avistado em {formatDate(s.seenAt)} · enviado {timeAgo(s.createdAt)}</div>
      <p className="type dim" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{s.description}</p>
      <div className="queue-actions">
        <span className="hud dim">Credibilidade</span>
        <StarsInput value={stars[s.id] ?? 3} onChange={(v) => setStars((m) => ({ ...m, [s.id]: v }))} />
        <button type="button" className="btn btn-sm btn-primary"
          onClick={() => decide(() => api.post(`/moderation/sightings/${s.id}/approve`, { credibility: stars[s.id] ?? 3 }), 'Caso verificado e publicado.')}>
          <Check size={14} /> Verificar
        </button>
        <button type="button" className="btn btn-sm btn-danger" onClick={() => {
          const reason = askReason();
          if (reason) decide(() => api.post(`/moderation/sightings/${s.id}/reject`, { reason }), 'Caso arquivado.');
        }}>
          <X size={14} /> Arquivar
        </button>
        <Link to={`/casos/${s.id}`} className="btn btn-sm btn-ghost"><Eye size={14} /> Abrir</Link>
      </div>
    </div>
  ));
}

function PhotoQueue({ items, onDone }) {
  const decide = useDecision(onDone);
  if (!items.length) return <Empty title="Sem evidências">Nenhuma foto esperando análise.</Empty>;
  return (
    <div className="photo-queue">
      {items.map((p) => (
        <div key={p.id} className="queue-item">
          <a href={p.url} target="_blank" rel="noopener noreferrer"><img src={p.thumbUrl} alt={`Foto do caso ${p.sightingTitle}`} style={{ width: '100%', aspectRatio: 1, objectFit: 'cover' }} /></a>
          <div>
            <Link to={`/casos/${p.sightingId}`} className="hud">{p.sightingTitle}</Link>
            <div className="mono mute" style={{ fontSize: 11, wordBreak: 'break-all' }}>
              {p.width}×{p.height} · {Math.round(p.sizeBytes / 1024)} KB<br />SHA-256 {p.sha256?.slice(0, 16)}…
            </div>
          </div>
          <div className="queue-actions">
            <button type="button" className="btn btn-sm btn-primary"
              onClick={() => decide(() => api.post(`/moderation/photos/${p.id}/approve`), 'Evidência aprovada.')}><Check size={14} /> Aprovar</button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => {
              const reason = askReason();
              if (reason) decide(() => api.post(`/moderation/photos/${p.id}/reject`, { reason }), 'Evidência rejeitada.');
            }}><X size={14} /> Rejeitar</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CommentQueue({ items, onDone }) {
  const decide = useDecision(onDone);
  if (!items.length) return <Empty title="Sem denúncias">Nenhum depoimento oculto por denúncia.</Empty>;
  return items.map((c) => (
    <div key={c.id} className="queue-item">
      <div className="hud dim">{c.author.name} em <Link to={`/casos/${c.sightingId}`} style={{ color: 'var(--sun-2)' }}>{c.sightingTitle}</Link></div>
      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{c.body}</p>
      <div className="mono mute">Denúncias: {c.reasons.join(' · ')}</div>
      <div className="queue-actions">
        <button type="button" className="btn btn-sm" onClick={() => decide(() => api.post(`/moderation/comments/${c.id}/restore`), 'Depoimento restaurado.')}>
          <Undo2 size={14} /> Restaurar
        </button>
        <button type="button" className="btn btn-sm btn-danger" onClick={() => decide(() => api.post(`/moderation/comments/${c.id}/remove`), 'Depoimento removido.')}>
          <Trash2 size={14} /> Remover
        </button>
      </div>
    </div>
  ));
}

const ACTION_LABEL = {
  'avistamento.aprovar': 'Verificou caso',
  'avistamento.rejeitar': 'Arquivou caso',
  'foto.aprovar': 'Aprovou evidência',
  'foto.rejeitar': 'Rejeitou evidência',
  'comentario.remover': 'Removeu depoimento',
  'comentario.restaurar': 'Restaurou depoimento',
};

function AuditLog() {
  const { data, loading, error, reload } = useApi('/moderation/audit');
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  return (
    <div className="panel table-wrap">
      <h2 className="panel-title">Registro imutável (somente inserção)</h2>
      <table className="audit-table">
        <thead><tr><th>Quando</th><th>Moderador</th><th>Ação</th><th>Alvo</th><th>Motivo</th><th>IP</th></tr></thead>
        <tbody>
          {data.items.map((a) => (
            <tr key={a.id}>
              <td className="mono">{new Date(a.created_at).toLocaleString('pt-BR')}</td>
              <td>{a.actor_name}</td>
              <td>{ACTION_LABEL[a.action] ?? a.action}</td>
              <td className="mono">{caseNumber(a.target_id)}</td>
              <td>{a.reason ?? '—'}</td>
              <td className="mono">{a.ip}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
