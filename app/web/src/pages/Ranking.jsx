import { Link } from 'react-router';
import { useApi } from '../lib/api.js';
import { CryptidSilhouette } from '../components/Art.jsx';
import { Stars } from '../components/Stars.jsx';
import { ErrorBox, Loading } from '../components/States.jsx';

// Nível de "procurado" proporcional ao líder do ranking.
const level = (total, top) => (top ? Math.max(total ? 1 : 0, Math.round((total / top) * 5)) : 0);

export default function Ranking() {
  const { data, error, loading, reload } = useApi('/ranking');
  const items = data?.items ?? [];
  const top = items[0]?.total ?? 0;

  return (
    <div className="container">
      <div className="page-head">
        <span className="section-kicker hud">Ranking por avistamentos verificados</span>
        <h1 className="display section-title">Mais procurados</h1>
      </div>
      {loading && <Loading />}
      {error && <ErrorBox error={error} onRetry={reload} />}
      {data && (
        <>
          <div className="wanted-grid" style={{ marginBottom: 48 }}>
            {items.slice(0, 3).map((c, i) => (
              <Link key={c.cryptidId} to={`/casos?cryptid=${c.slug}`} className="wanted">
                <span className="wanted-rank">{i + 1}</span>
                <div className="wanted-head">Procura-se</div>
                <div className="wanted-photo"><CryptidSilhouette slug={c.slug} /></div>
                <div className="wanted-name">{c.name}</div>
                <Stars value={level(c.total, top)} label={false} />
                <div className="wanted-count">{c.total} avistamento{c.total === 1 ? '' : 's'}</div>
              </Link>
            ))}
          </div>
          <ol className="rank-list" style={{ marginBottom: 64 }}>
            {items.map((c, i) => (
              <li key={c.cryptidId}>
                <Link to={`/casos?cryptid=${c.slug}`} className="rank-row">
                  <span className="rank-pos">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    <span className="case-title" style={{ fontSize: 20 }}>{c.name}</span>
                    <span className="rank-bar"><span style={{ width: `${top ? (c.total / top) * 100 : 0}%` }} /></span>
                  </span>
                  <span className="display" style={{ fontSize: 28 }}>{c.total}</span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="mono mute" style={{ marginTop: -40, marginBottom: 64 }}>Fonte: {data.source === 'cache' ? 'cache Redis' : 'banco de dados'}</p>
        </>
      )}
    </div>
  );
}
