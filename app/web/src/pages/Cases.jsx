import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { qs, useApi } from '../lib/api.js';
import { UFS } from '../lib/format.js';
import { CaseCard } from '../components/CaseCard.jsx';
import { Empty, ErrorBox, Loading } from '../components/States.jsx';

const LIMIT = 12;

export default function Cases() {
  const [params, setParams] = useSearchParams();
  const cryptids = useApi('/cryptids');
  const page = Number(params.get('page') || 1);
  const filters = {
    q: params.get('q') || '',
    cryptid: params.get('cryptid') || '',
    uf: params.get('uf') || '',
    sort: params.get('sort') || 'seen_at',
  };
  const [q, setQ] = useState(filters.q);
  useEffect(() => setQ(filters.q), [filters.q]);

  const list = useApi(`/sightings${qs({ ...filters, page, limit: LIMIT })}`);

  const update = (changes) => {
    const next = { ...filters, ...changes, page: changes.page ?? 1 };
    const clean = Object.fromEntries(Object.entries(next).filter(([k, v]) => v && !(k === 'page' && v === 1) && !(k === 'sort' && v === 'seen_at')));
    setParams(clean);
  };

  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="container">
      <div className="page-head">
        <span className="section-kicker">Arquivo público</span>
        <h1 className="display section-title">Casos verificados</h1>
        <p className="dim" style={{ margin: '8px 0 0' }}>{list.data ? `${total} caso${total === 1 ? '' : 's'} encontrados` : ' '}</p>
      </div>

      <form className="filters paper on-paper" role="search" onSubmit={(e) => { e.preventDefault(); update({ q: q.trim() }); }}>
        <div className="field">
          <label htmlFor="f-q">Buscar no arquivo</label>
          <input id="f-q" className="input" value={q} maxLength={100} placeholder="Pegada, luz no céu, Varginha…"
            onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="f-cryptid">Criptídeo</label>
          <select id="f-cryptid" className="select" value={filters.cryptid} onChange={(e) => update({ cryptid: e.target.value })}>
            <option value="">Todos</option>
            {cryptids.data?.items.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-uf">Estado</label>
          <select id="f-uf" className="select" value={filters.uf} onChange={(e) => update({ uf: e.target.value })}>
            <option value="">Todos</option>
            {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-sort">Ordenar por</label>
          <select id="f-sort" className="select" value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
            <option value="seen_at">Data do avistamento</option>
            <option value="created_at">Mais recentes no arquivo</option>
            <option value="credibility">Credibilidade</option>
            <option value="title">Título</option>
          </select>
        </div>
        <button type="submit" className="btn"><Search size={16} /> Buscar</button>
      </form>

      {list.loading && <Loading />}
      {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
      {list.data && (list.data.items.length ? (
        <>
          <div className="case-grid">{list.data.items.map((s) => <CaseCard key={s.id} s={s} />)}</div>
          {pages > 1 && (
            <nav className="pager" aria-label="Páginas">
              <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => update({ page: page - 1 })}>
                <ChevronLeft size={16} /> Anterior
              </button>
              <span className="mono">{page} / {pages}</span>
              <button type="button" className="btn btn-sm" disabled={page >= pages} onClick={() => update({ page: page + 1 })}>
                Próxima <ChevronRight size={16} />
              </button>
            </nav>
          )}
        </>
      ) : (
        <Empty title="Nada encontrado no arquivo">Nenhum caso bate com esses filtros. Tente outra busca.</Empty>
      ))}
      <div style={{ height: 64 }} />
    </div>
  );
}
