import { Link } from 'react-router';
import { Plus, Trash2 } from 'lucide-react';
import { api, useApi } from '../lib/api.js';
import { caseNumber, formatDate } from '../lib/format.js';
import { Stamp } from '../components/Stamp.jsx';
import { useToast } from '../components/Toast.jsx';
import { Empty, ErrorBox, Loading } from '../components/States.jsx';

export default function MyCases() {
  const { data, error, loading, reload } = useApi('/sightings/mine');
  const toast = useToast();

  async function remove(s) {
    if (!window.confirm(`Apagar o caso "${s.title}"? Isso não pode ser desfeito.`)) return;
    try {
      await api.del(`/sightings/${s.id}`);
      toast('Caso apagado do arquivo.');
      reload();
    } catch (err) {
      toast(err.message);
    }
  }

  return (
    <div className="container">
      <div className="page-head section-head">
        <div>
          <span className="section-kicker">Sua pasta</span>
          <h1 className="display section-title">Meus casos</h1>
        </div>
        <Link to="/reportar" className="btn btn-primary"><Plus size={16} /> Novo relato</Link>
      </div>
      {loading && <Loading />}
      {error && <ErrorBox error={error} onRetry={reload} />}
      {data && (data.items.length ? (
        <div className="rank-list" style={{ marginBottom: 64 }}>
          {data.items.map((s) => (
            <div key={s.id} className="queue-item paper on-paper">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'start' }}>
                <div>
                  <div className="mono blood">{caseNumber(s.id)} · {s.cryptid.name}</div>
                  <Link to={`/casos/${s.id}`} className="case-title" style={{ display: 'block', marginTop: 4 }}>{s.title}</Link>
                  <div className="label" style={{ marginTop: 4 }}>{s.city}/{s.uf} · {formatDate(s.seenAt)}</div>
                </div>
                <Stamp status={s.status} />
              </div>
              {s.status === 'rejeitado' && s.rejectReason && <div className="alert">Motivo: {s.rejectReason}</div>}
              {s.status === 'pendente' && (
                <div className="queue-actions">
                  <Link to={`/casos/${s.id}`} className="btn btn-sm">Abrir e anexar fotos</Link>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(s)}><Trash2 size={14} /> Apagar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty title="Pasta vazia" action={<Link to="/reportar" className="btn btn-primary">Reportar avistamento</Link>}>
          Você ainda não reportou nenhum avistamento.
        </Empty>
      ))}
    </div>
  );
}
