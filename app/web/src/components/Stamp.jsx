import { STATUS_LABEL } from '../lib/format.js';

export function Stamp({ status, large }) {
  return (
    <span className={`stamp stamp-${status}${large ? ' stamp-lg' : ''}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
