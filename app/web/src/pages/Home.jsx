import { Link } from 'react-router';
import { ArrowRight, Feather } from 'lucide-react';
import { useApi } from '../lib/api.js';
import { CaseCard } from '../components/CaseCard.jsx';
import { CasesMap } from '../components/Maps.jsx';
import { CryptidSilhouette, OldPhotoScene, WaxSeal } from '../components/Art.jsx';
import { Empty, ErrorBox, Loading } from '../components/States.jsx';

export default function Home() {
  const stats = useApi('/stats');
  const featured = useApi('/sightings?sort=credibility&order=desc&limit=6');
  const forMap = useApi('/sightings?limit=50&sort=created_at');
  const ranking = useApi('/ranking');
  const s = stats.data;

  return (
    <>
      {/* Tela 1: a carta de abertura + a fotografia anexada. Cabe inteira na tela do notebook. */}
      <section className="screen hero">
        <div className="container hero-grid">
          <div>
            <span className="hero-kicker">
              <span className="stamp stamp-aprovado">confidencial</span>
              arquivo nº 0417
            </span>
            <h1 className="display hero-title">Você <span className="scribble">viu</span> alguma coisa?</h1>
            <p className="hero-sub">
              Um vulto na trilha, uma luz que não devia estar no banhado, pegadas que não são de bicho
              nenhum. Registre o que viu. Cada relato é lido, verificado e arquivado.
            </p>
            <div className="hero-actions">
              <Link to="/reportar" className="btn btn-primary"><Feather size={17} /> Registrar relato</Link>
              <Link to="/casos" className="btn">Abrir o arquivo <ArrowRight size={17} /></Link>
            </div>
            <div className="ledger" aria-label="Números do arquivo">
              {[
                [s?.cases, 'casos verificados'],
                [s?.cases30d, 'nos últimos 30 dias'],
                [s?.cryptids, 'criaturas registradas'],
                [s?.states, 'estados com relatos'],
              ].map(([value, label]) => (
                <div key={label}><strong>{value ?? '—'}</strong><span>{label}</span></div>
              ))}
            </div>
          </div>

          <div className="hero-evidence">
            <div className="clip-note paper hand" aria-hidden="true">não estava sozinho na trilha…</div>
            <figure className="old-photo" style={{ margin: 0 }}>
              <span className="tape tape-tl" aria-hidden="true" />
              <div className="frame"><OldPhotoScene /></div>
              <figcaption className="caption hand">Serra do Mar, set. 1987</figcaption>
            </figure>
            <WaxSeal title="Selo de cera do arquivo" />
          </div>
        </div>
      </section>

      {/* Tela 2: casos em destaque */}
      <section className="screen">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="section-kicker">maior credibilidade</span>
              <h2 className="display section-title">Casos em destaque</h2>
            </div>
            <Link to="/casos" className="btn btn-ghost">Ver o arquivo completo <ArrowRight size={16} /></Link>
          </div>
          {featured.loading && <Loading />}
          {featured.error && <ErrorBox error={featured.error} onRetry={featured.reload} />}
          {featured.data && (featured.data.items.length
            ? <div className="case-grid">{featured.data.items.map((c) => <CaseCard key={c.id} s={c} />)}</div>
            : <Empty title="O arquivo está vazio" action={<Link to="/reportar" className="btn btn-primary">Registrar o primeiro relato</Link>}>
                Nenhum caso verificado ainda.
              </Empty>)}
        </div>
      </section>

      {/* Tela 3: mapa */}
      <section className="screen">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="section-kicker">mapa da investigação</span>
              <h2 className="display section-title">Onde estão aparecendo</h2>
            </div>
          </div>
          {forMap.data ? <CasesMap items={forMap.data.items} /> : <Loading label="Abrindo o mapa…" />}
        </div>
      </section>

      {/* Tela 4: os mais avistados, em selos postais */}
      <section className="screen">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="section-kicker">coleção do arquivo</span>
              <h2 className="display section-title">Os mais avistados</h2>
            </div>
            <Link to="/ranking" className="btn btn-ghost">Ranking completo <ArrowRight size={16} /></Link>
          </div>
          {ranking.data && (
            <div className="stamp-grid">
              {ranking.data.items.slice(0, 4).map((c, i) => (
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
          )}
        </div>
      </section>
    </>
  );
}
