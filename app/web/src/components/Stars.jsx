const STAR = 'M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.6-.7z';

/** Nível de credibilidade em estrelas, no estilo do medidor de "procurado". */
export function Stars({ value = 0, size, label = true }) {
  const n = value ?? 0;
  return (
    <span className={`stars${size === 'lg' ? ' stars-lg' : ''}`} role="img"
      aria-label={label ? `Credibilidade ${n} de 5` : undefined}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 24 24" aria-hidden="true"><path d={STAR} className={i <= n ? 'on' : 'off'} /></svg>
      ))}
    </span>
  );
}

export function StarsInput({ value, onChange }) {
  return (
    <span className="stars stars-lg stars-input" role="radiogroup" aria-label="Credibilidade">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} estrela${i > 1 ? 's' : ''}`}
          onClick={() => onChange(i)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={STAR} className={i <= value ? 'on' : 'off'} /></svg>
        </button>
      ))}
    </span>
  );
}
