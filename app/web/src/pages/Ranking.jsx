import { Link } from 'react-router';
import { useApi } from '../lib/api.js';
import { CryptidSilhouette } from '../components/Art.jsx';
import { ErrorBox, Loading } from '../components/States.jsx';

export default function Ranking() {
  const { data, error, loading, reload } = useApi('/ranking');
  const items = data?.items ?? [];
  const top = items[0]?.total ?? 0;

  return (
    <div className="container">
      <div className="page-head">
        <span className="section-kicker">coleção do arquivo · só relatos verificados</span>
        <h1 className="display section-title">Os mais avistados</h1>
      </div>
      {loading && <Loading />}
      {error && <ErrorBox error={error} onRetry={reload} />}
      {data && (
        <>
          <div className="stamp-grid" style={{ marginBottom: 56 }}>
            {items.slice(0, 4).map((c, i) => (
              <Link key={c.cryptidId} to={`/casos?cryptid=${c.slug}`} className="postage">
                <span className="postage-value">{i + 1}</span>
                <div className="postage-inner">
                  <div className="postage-art"><CryptidSilhouette slug={c.slug} /></div>
                  <p className="postage-name">{c.name}</p>
                  <div className="postage-foot">
                    <span>{c.total} avistamento{c.total === 1 ? '' : 's'}</span>
                    <span>CW</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <ol className="rank-list">
            {items.map((c, i) => (
              <li key={c.cryptidId}>
                <Link to={`/casos?cryptid=${c.slug}`} className="rank-row paper">
                  <span className="rank-pos">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    <span className="case-title" style={{ fontSize: 19 }}>{c.name}</span>
                    <span className="rank-bar"><span style={{ width: `${top ? (c.total / top) * 100 : 0}%` }} /></span>
                  </span>
                  <span className="display" style={{ fontSize: 26 }}>{c.total}</span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="mute" style={{ margin: '16px 0 64px', fontSize: 13 }}>
            Fonte: {data.source === 'cache' ? 'cache Redis' : 'banco de dados'}
          </p>
        </>
      )}
    </div>
  );
}
