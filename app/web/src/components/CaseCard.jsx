import { Link } from 'react-router';
import { Calendar, MapPin, MessageSquare } from 'lucide-react';
import { caseNumber, formatDate } from '../lib/format.js';
import { Stars } from './Stars.jsx';
import { Stamp } from './Stamp.jsx';

/** Ficha de arquivo: fotografia antiga presa no topo e dados datilografados. */
export function CaseCard({ s, showStatus = false }) {
  return (
    <Link to={`/casos/${s.id}`} className="case-card paper">
      <div className="case-photo">
        <span className="case-tag">{s.cryptid.name}</span>
        {s.coverUrl
          ? <img src={s.coverUrl} alt={`Evidência do caso ${s.title}`} loading="lazy" />
          : <div className="case-photo-empty">sem registro fotográfico</div>}
      </div>
      <div className="case-body">
        <div className="case-meta">
          <span>{caseNumber(s.id)}</span>
          {showStatus ? <Stamp status={s.status} /> : <Stars value={s.credibility} />}
        </div>
        <h3 className="case-title">{s.title}</h3>
        <p className="case-excerpt">{s.description}</p>
        <div className="case-foot">
          <span className="inline-icon"><MapPin size={13} /> {s.city}/{s.uf}</span>
          <span className="inline-icon"><Calendar size={13} /> {formatDate(s.seenAt)}</span>
          {!showStatus && <span className="inline-icon"><MessageSquare size={13} /> {s.commentCount}</span>}
        </div>
      </div>
    </Link>
  );
}
