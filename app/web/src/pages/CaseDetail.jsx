import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Calendar, Camera, Flag, MapPin, MessageSquare, Radar, Trash2, User, X } from 'lucide-react';
import { api, useApi } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { caseNumber, formatDate, timeAgo } from '../lib/format.js';
import { Stars } from '../components/Stars.jsx';
import { Stamp } from '../components/Stamp.jsx';
import { RadarMap } from '../components/Maps.jsx';
import { PhotoUploader } from '../components/PhotoUploader.jsx';
import { useToast } from '../components/Toast.jsx';
import { ErrorBox, Loading, NotFound } from '../components/States.jsx';

export default function CaseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: s, error, loading, reload } = useApi(`/sightings/${id}`);
  const [zoom, setZoom] = useState(null);

  if (loading) return <Loading />;
  if (error?.status === 404) return <NotFound />;
  if (error) return <div className="container section"><ErrorBox error={error} onRetry={reload} /></div>;

  const isOwner = user?.id === s.author.id;
  const canAddPhotos = isOwner && s.status !== 'rejeitado' && s.photos.length < 3;

  return (
    <div className="container">
      <div style={{ paddingTop: 24 }}>
        <Link to="/casos" className="btn btn-ghost btn-sm"><ArrowLeft size={16} /> Voltar ao arquivo</Link>
      </div>

      <article className="dossier">
        <div>
          <header className="dossier-head">
            <span className="case-number">CASO {caseNumber(s.id)}</span>
            <Stamp status={s.status} large />
            <h1 className="display dossier-title">{s.title}</h1>
            <div className="hud dim" style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <span className="inline-icon"><MapPin size={14} /> {s.city}/{s.uf}</span>
              <span className="inline-icon"><Calendar size={14} /> {formatDate(s.seenAt)}</span>
              <span className="inline-icon"><User size={14} /> Testemunha: {s.author.name}</span>
            </div>
          </header>

          {s.status === 'rejeitado' && s.rejectReason && (
            <div className="alert" style={{ marginBottom: 20 }}>Arquivado pelo moderador: {s.rejectReason}</div>
          )}

          <div className="paper-sheet">
            <div className="hud" style={{ marginBottom: 10 }}>Relato da testemunha</div>
            <p className="dossier-text" style={{ margin: 0 }}>{s.description}</p>
          </div>

          {s.photos.length > 0 && (
            <div className="evidence-grid">
              {s.photos.map((p, i) => (
                <button key={p.id} type="button" className="evidence" onClick={() => setZoom(p.url)}
                  aria-label={`Ampliar evidência ${i + 1}`}>
                  <img src={p.thumbUrl} alt={`Evidência ${i + 1} do caso`} loading="lazy" />
                  {p.status !== 'aprovado' && <Stamp status={p.status} />}
                  <span>Evidência {String(i + 1).padStart(2, '0')}</span>
                </button>
              ))}
            </div>
          )}

          {canAddPhotos && (
            <div className="panel" style={{ marginTop: 28 }}>
              <h2 className="panel-title"><Camera size={16} /> Anexar evidências</h2>
              <PhotoUploader sightingId={s.id} max={3 - s.photos.length} />
            </div>
          )}

          {s.status === 'aprovado' && <Comments sightingId={s.id} />}
        </div>

        <aside className="side-panel">
          <div className="panel">
            <h2 className="panel-title"><Radar size={16} /> Localização</h2>
            <RadarMap lat={s.latitude} lng={s.longitude} />
            {s.latitude != null && (
              <p className="mono dim" style={{ textAlign: 'center', margin: '12px 0 0' }}>
                {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
              </p>
            )}
          </div>
          <div className="panel">
            <h2 className="panel-title">Ficha</h2>
            <dl className="facts">
              <div><dt>Criptídeo</dt><dd><Link to={`/casos?cryptid=${s.cryptid.slug}`} style={{ color: 'var(--sun-2)' }}>{s.cryptid.name}</Link></dd></div>
              <div><dt>Avistado em</dt><dd>{formatDate(s.seenAt)}</dd></div>
              <div><dt>Local</dt><dd>{s.city}/{s.uf}</dd></div>
              <div><dt>Credibilidade</dt><dd>{s.credibility ? <Stars value={s.credibility} /> : <span className="dim">Em análise</span>}</dd></div>
              <div><dt>Arquivado</dt><dd>{timeAgo(s.createdAt)}</dd></div>
            </dl>
          </div>
        </aside>
      </article>

      {zoom && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Evidência ampliada" onClick={() => setZoom(null)}>
          <button type="button" className="btn" onClick={() => setZoom(null)} aria-label="Fechar"><X size={18} /></button>
          <img src={zoom} alt="Evidência ampliada" />
        </div>
      )}
    </div>
  );
}

function Comments({ sightingId }) {
  const { user, isModerator } = useAuth();
  const toast = useToast();
  const { data, reload } = useApi(`/sightings/${sightingId}/comments`);
  const [body, setBody] = useState('');
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api.post(`/sightings/${sightingId}/comments`, { body });
      setBody('');
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function remove(c) {
    if (!window.confirm('Apagar este depoimento?')) return;
    try {
      await api.del(`/comments/${c.id}`);
      reload();
    } catch (err) {
      toast(err.message);
    }
  }

  async function report(c) {
    const reason = window.prompt('Por que este depoimento deve ser revisado?');
    if (!reason) return;
    try {
      const r = await api.post(`/comments/${c.id}/report`, { reason });
      toast(r.hidden ? 'Depoimento ocultado até a revisão do moderador.' : 'Denúncia recebida. Obrigado.');
      if (r.hidden) reload();
    } catch (err) {
      toast(err.message);
    }
  }

  const items = data?.items ?? [];
  return (
    <section className="comments" aria-labelledby="comments-title">
      <div className="section-head" style={{ marginBottom: 20 }}>
        <h2 id="comments-title" className="display" style={{ fontSize: 40 }}>
          Depoimentos <span className="dim">({items.length})</span>
        </h2>
      </div>

      {items.map((c) => (
        <div key={c.id} className="comment">
          <div className="comment-head">
            <span className="comment-author">{c.author.name}</span>
            <span className="mono mute">{timeAgo(c.createdAt)}</span>
            {user && (
              <span className="comment-actions">
                {(user.id === c.author.id || isModerator) && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(c)} aria-label="Apagar depoimento">
                    <Trash2 size={14} />
                  </button>
                )}
                {user.id !== c.author.id && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => report(c)} aria-label="Denunciar depoimento">
                    <Flag size={14} />
                  </button>
                )}
              </span>
            )}
          </div>
          {/* SEC-101: texto puro; o React escapa tudo. */}
          <p className="comment-body">{c.body}</p>
        </div>
      ))}
      {data && items.length === 0 && <p className="dim">Ninguém comentou ainda. Viu algo parecido?</p>}

      {user ? (
        <form onSubmit={submit} className="form-grid" style={{ marginTop: 24 }}>
          <div className="field">
            <label htmlFor="comment">Seu depoimento</label>
            <textarea id="comment" className="textarea" style={{ minHeight: 110 }} maxLength={1000} required minLength={2}
              value={body} onChange={(e) => setBody(e.target.value)} placeholder="Também vi algo assim perto de casa…" />
            <span className="field-hint">{body.length}/1000 · texto simples, sem links clicáveis</span>
          </div>
          {error && <div className="alert">{error}</div>}
          <div><button className="btn btn-primary" disabled={sending || body.trim().length < 2}><MessageSquare size={16} /> Publicar</button></div>
        </form>
      ) : (
        <p className="dim"><Link to="/entrar" style={{ color: 'var(--sun-2)' }}>Entre</Link> para deixar seu depoimento.</p>
      )}
    </section>
  );
}
