import { Link } from 'react-router';
import { Calendar, ImageOff, MapPin, MessageSquare } from 'lucide-react';
import { caseNumber, formatDate } from '../lib/format.js';
import { Stars } from './Stars.jsx';
import { Stamp } from './Stamp.jsx';

export function CaseCard({ s, showStatus = false }) {
  return (
    <Link to={`/casos/${s.id}`} className="case-card">
      <div className="case-cover">
        {s.coverUrl
          ? <img src={s.coverUrl} alt="" loading="lazy" />
          : <div className="case-cover-empty"><span className="hud inline-icon"><ImageOff size={16} /> sem evidência visual</span></div>}
        <span className="tag tag-sun">{s.cryptid.name}</span>
      </div>
      <div className="case-body">
        <div className="case-meta mono">
          <span>{caseNumber(s.id)}</span>
          {showStatus ? <Stamp status={s.status} /> : <Stars value={s.credibility} />}
        </div>
        <h3 className="case-title">{s.title}</h3>
        <p className="case-excerpt">{s.description}</p>
        <div className="case-foot hud">
          <span className="inline-icon"><MapPin size={14} /> {s.city}/{s.uf}</span>
          <span className="inline-icon"><Calendar size={14} /> {formatDate(s.seenAt)}</span>
          {!showStatus && <span className="inline-icon"><MessageSquare size={14} /> {s.commentCount}</span>}
        </div>
      </div>
    </Link>
  );
}
