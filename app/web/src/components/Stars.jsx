/** Credibilidade de 1 a 5 como marcas de tinta vermelha (o moderador dá na verificação). */
export function Stars({ value = 0, size, label = true }) {
  const n = value ?? 0;
  return (
    <span className={`cred${size === 'lg' ? ' cred-lg' : ''}`} role="img"
      aria-label={label ? `Credibilidade ${n} de 5` : undefined} title={`Credibilidade ${n} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= n ? 'on' : ''} />)}
    </span>
  );
}

export function StarsInput({ value, onChange }) {
  return (
    <span className="cred cred-input" role="radiogroup" aria-label="Credibilidade">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} de 5`} onClick={() => onChange(i)}>
          <i className={i <= value ? 'on' : ''} />
        </button>
      ))}
    </span>
  );
}
