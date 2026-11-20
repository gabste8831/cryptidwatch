import { Link } from 'react-router';
import { ArrowRight, Crosshair, Plus } from 'lucide-react';
import { useApi } from '../lib/api.js';
import { CaseCard } from '../components/CaseCard.jsx';
import { CasesMap } from '../components/Maps.jsx';
import { CryptidSilhouette, SunsetScene } from '../components/Art.jsx';
import { Empty, ErrorBox, Loading } from '../components/States.jsx';

export default function Home() {
  const stats = useApi('/stats');
  const featured = useApi('/sightings?sort=credibility&order=desc&limit=6');
  const forMap = useApi('/sightings?limit=50&sort=created_at');
  const ranking = useApi('/ranking');

  const s = stats.data;
  return (
    <>
      <section className="hero">
        <div className="hero-art"><SunsetScene /></div>
        <div className="container hero-content">
          <span className="hero-kicker hud"><Crosshair size={14} /> Arquivo aberto · relatos verificados</span>
          <h1 className="display hero-title">Você <em>viu</em> alguma coisa?</h1>
          <p className="hero-sub">
            Pé-Grande na trilha, luz estranha no banhado, pegada que não é de bicho nenhum.
            Registre o que viu. A comunidade comenta e o moderador avalia.
          </p>
          <div className="hero-actions">
            <Link to="/reportar" className="btn btn-primary"><Plus size={18} /> Reportar avistamento</Link>
            <Link to="/casos" className="btn">Explorar casos <ArrowRight size={18} /></Link>
          </div>
        </div>
        <div className="stats-strip">
          {[
            [s?.cases, 'casos verificados'],
            [s?.cases30d, 'nos últimos 30 dias'],
            [s?.cryptids, 'criptídeos avistados'],
            [s?.states, 'estados com relatos'],
          ].map(([value, label]) => (
            <div key={label} className="stat">
              <div className="stat-value">{value ?? '—'}</div>
              <div className="stat-label hud">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section container">
        <div className="section-head">
          <div>
            <span className="section-kicker hud">Maior credibilidade</span>
            <h2 className="display section-title">Casos em destaque</h2>
          </div>
          <Link to="/casos" className="btn btn-ghost">Ver todos <ArrowRight size={16} /></Link>
        </div>
        {featured.loading && <Loading />}
        {featured.error && <ErrorBox error={featured.error} onRetry={featured.reload} />}
        {featured.data && (featured.data.items.length
          ? <div className="case-grid">{featured.data.items.map((c) => <CaseCard key={c.id} s={c} />)}</div>
          : <Empty title="Arquivo vazio" action={<Link to="/reportar" className="btn btn-primary">Abrir o primeiro caso</Link>}>
              Nenhum caso verificado ainda.
            </Empty>)}
      </section>

      <section className="section container" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <span className="section-kicker hud">Radar</span>
            <h2 className="display section-title">Onde estão aparecendo</h2>
          </div>
        </div>
        {forMap.data ? <CasesMap items={forMap.data.items} /> : <Loading label="Ligando o radar…" />}
      </section>

      <section className="section container" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <span className="section-kicker hud">Ranking</span>
            <h2 className="display section-title">Mais procurados</h2>
          </div>
          <Link to="/ranking" className="btn btn-ghost">Ranking completo <ArrowRight size={16} /></Link>
        </div>
        {ranking.data && (
          <div className="wanted-grid">
            {ranking.data.items.slice(0, 4).map((c, i) => (
              <Link key={c.cryptidId} to={`/casos?cryptid=${c.slug}`} className="wanted">
                <span className="wanted-rank">{i + 1}</span>
                <div className="wanted-head">Procura-se</div>
                <div className="wanted-photo"><CryptidSilhouette slug={c.slug} /></div>
                <div className="wanted-name">{c.name}</div>
                <div className="wanted-count">{c.total} avistamento{c.total === 1 ? '' : 's'}</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
