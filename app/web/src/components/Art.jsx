/* Ilustrações originais em SVG: fotografia antiga de mata com névoa, selo de cera e
   silhuetas para os selos postais. Tudo desenhado aqui, sem imagens externas. */

// Vulto bípede andando, braço balançando: a pose clássica dos filmes de avistamento.
const SQUATCH = `M58 4c9 0 15 7 15 16 0 4-1 7-3 10 9 3 15 10 17 20l6 30c1 5-2 9-6 9-3 0-5-2-6-5l-6-24-2 30
  5 40c1 6-3 10-8 10s-8-3-9-8l-5-34-4 34c-1 5-4 8-9 8s-9-4-8-10l5-42-1-28-8 20c-1 3-4 5-7 4-4-1-6-5-5-9l9-28
  c3-9 9-15 17-17-2-3-3-7-3-11 0-9 6-15 14-15z`;

function pines(y, color, count, height, width, seed = 1) {
  const xs = Array.from({ length: count }, (_, i) => (i / count) * width + ((i * 97 * seed) % 30) - 15);
  return pinesAt(xs, y, color, height, seed);
}

/** Pinheiros em posições escolhidas (para deixar uma clareira onde o vulto aparece). */
function pinesAt(xs, y, color, height, seed = 1) {
  const d = [];
  for (let i = 0; i < xs.length; i += 1) {
    const x = xs[i];
    const h = height * (0.65 + (((i * 53 * seed) % 40) / 100));
    const w = h * 0.24;
    // Pinheiro em camadas (mais natural que um triângulo só).
    d.push(`M${x} ${y} L${x + w} ${y - h * 0.45} L${x + w * 0.55} ${y - h * 0.45} L${x + w * 1.1} ${y - h * 0.75}
      L${x + w * 0.75} ${y - h * 0.75} L${x + w * 1.25} ${y - h} L${x + w * 1.75} ${y - h * 0.75} L${x + w * 1.4} ${y - h * 0.75}
      L${x + w * 1.95} ${y - h * 0.45} L${x + w * 1.5} ${y - h * 0.45} L${x + w * 2.5} ${y} Z`);
  }
  return <path d={d.join(' ')} fill={color} />;
}

/** Fotografia antiga: mata à noite, névoa e um vulto parado entre as árvores. */
export function OldPhotoScene({ label = 'Fotografia de uma mata com névoa e um vulto entre as árvores' }) {
  return (
    <svg viewBox="0 0 400 460" preserveAspectRatio="xMidYMid slice" role="img" aria-label={label}>
      <defs>
        <linearGradient id="op-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a3b2b" />
          <stop offset="0.45" stopColor="#8a7457" />
          <stop offset="0.7" stopColor="#6b5841" />
          <stop offset="1" stopColor="#1e1711" />
        </linearGradient>
        <radialGradient id="op-moon" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f1e6c8" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#e0d0a8" stopOpacity="0.5" />
          <stop offset="1" stopColor="#e0d0a8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="op-fog" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9c9a6" stopOpacity="0" />
          <stop offset="0.5" stopColor="#d9c9a6" stopOpacity="0.45" />
          <stop offset="1" stopColor="#d9c9a6" stopOpacity="0" />
        </linearGradient>
        <filter id="op-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" />
          <feColorMatrix values="0 0 0 0 0.2  0 0 0 0 0.15  0 0 0 0 0.1  0 0 0 0.35 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
      <rect width="400" height="460" fill="url(#op-sky)" />
      <circle cx="285" cy="120" r="120" fill="url(#op-moon)" />
      <circle cx="285" cy="120" r="26" fill="#efe3c3" opacity="0.85" />
      {pines(300, '#5c4b38', 16, 130, 420, 2)}
      <rect y="225" width="400" height="90" fill="url(#op-fog)" />
      {/* Fileira do meio com uma clareira entre x≈120 e x≈250. */}
      {pinesAt([-30, 20, 70, 255, 300, 345, 385], 365, '#3a2e22', 200, 5)}
      {/* O vulto, parado na clareira, olhando para a câmera. */}
      <g transform="translate(160 232) scale(0.66)" opacity="0.94">
        <path d={SQUATCH} fill="#140f0b" />
      </g>
      <rect y="320" width="400" height="80" fill="url(#op-fog)" opacity="0.85" />
      {/* Árvores da frente só nas laterais, emoldurando a cena. */}
      {pinesAt([-70, -20, 330, 372], 470, '#120d09', 320, 3)}
      <rect width="400" height="460" filter="url(#op-grain)" />
    </svg>
  );
}

/* ---------- Selo de cera ---------- */

// Contorno irregular de cera derramada (determinístico: o mesmo formato sempre).
function waxOutline(cx, cy, r, n = 30) {
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + 0.07 * Math.sin(i * 2.9) + 0.05 * Math.cos(i * 5.3) + (i % 7 === 0 ? 0.08 : 0);
    pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k]);
  }
  let d = '';
  pts.forEach((p, i) => {
    const next = pts[(i + 1) % n];
    const mid = [(p[0] + next[0]) / 2, (p[1] + next[1]) / 2];
    d += i === 0 ? `M${mid[0].toFixed(1)} ${mid[1].toFixed(1)}` : '';
    d += ` Q${next[0].toFixed(1)} ${next[1].toFixed(1)} ${((next[0] + pts[(i + 2) % n][0]) / 2).toFixed(1)} ${((next[1] + pts[(i + 2) % n][1]) / 2).toFixed(1)}`;
  });
  return `${d} Z`;
}
const WAX_PATH = waxOutline(60, 60, 54);

/** Selo de cera vermelho-sangue com um olho gravado (ou iniciais). */
export function WaxSeal({ initials, className = 'wax', title = 'Selo de cera' }) {
  return (
    <span className={className} role="img" aria-label={title}>
      <svg viewBox="0 0 120 120">
        <defs>
          <radialGradient id="wax-fill" cx="0.38" cy="0.32" r="0.75">
            <stop offset="0" stopColor="#c03a2c" />
            <stop offset="0.45" stopColor="#8f1d18" />
            <stop offset="1" stopColor="#4d0b09" />
          </radialGradient>
          <radialGradient id="wax-inner" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.7" stopColor="#7a1612" />
            <stop offset="1" stopColor="#5a0f0d" />
          </radialGradient>
        </defs>
        <path d={WAX_PATH} fill="url(#wax-fill)" />
        <circle cx="60" cy="60" r="37" fill="url(#wax-inner)" />
        <circle cx="60" cy="60" r="37" fill="none" stroke="#3d0807" strokeWidth="2" />
        <circle cx="60" cy="60" r="31" fill="none" stroke="#b8392c" strokeWidth="1" strokeDasharray="2 3" opacity="0.7" />
        {initials ? (
          <text x="60" y="70" textAnchor="middle" fontFamily="'Special Elite', monospace" fontSize="28" fill="#3d0807">
            {initials}
          </text>
        ) : (
          <g fill="none" stroke="#3d0807" strokeWidth="3" strokeLinecap="round">
            <path d="M38 60c7-10 14-14 22-14s15 4 22 14c-7 10-14 14-22 14s-15-4-22-14z" />
            <circle cx="60" cy="60" r="6" fill="#3d0807" />
          </g>
        )}
        {/* brilho da cera */}
        <path d="M30 40c6-10 16-16 26-17" fill="none" stroke="#e8705e" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
      </svg>
    </span>
  );
}

export function LogoMark(props) {
  return <WaxSeal className={`wax ${props.className ?? ''}`} title="CryptidWatch" />;
}

/* ---------- Silhuetas dos selos postais ---------- */
const SHAPES = {
  humanoid: <path d={SQUATCH} transform="translate(27 6) scale(1.3)" />,
  alien: (
    <g>
      <ellipse cx="100" cy="70" rx="46" ry="58" />
      <rect x="84" y="118" width="32" height="70" rx="12" />
      <ellipse cx="82" cy="70" rx="14" ry="20" fill="#d9c9a6" />
      <ellipse cx="118" cy="70" rx="14" ry="20" fill="#d9c9a6" />
      <circle cx="82" cy="74" r="6" fill="#8b1a17" />
      <circle cx="118" cy="74" r="6" fill="#8b1a17" />
    </g>
  ),
  serpent: <path d="M20 150c30-60 60 20 90-30s50-40 60-80c5-20 20-20 22 0 2 15-8 20-14 40-12 44-48 50-70 86s-60 30-88-16z" />,
  saucer: (
    <g>
      <ellipse cx="100" cy="92" rx="34" ry="24" />
      <ellipse cx="100" cy="104" rx="84" ry="20" />
      <ellipse cx="100" cy="100" rx="84" ry="10" fill="#d9c9a6" opacity="0.35" />
      {[52, 76, 100, 124, 148].map((x) => <circle key={x} cx={x} cy="106" r="4.5" fill="#d9c9a6" />)}
      <path d="M78 124 L58 192 H142 L122 124 Z" opacity="0.28" />
    </g>
  ),
  grey: (
    <g>
      <path d="M100 18c-38 0-58 26-58 56 0 34 32 66 58 78 26-12 58-44 58-78 0-30-20-56-58-56z" />
      <path d="M62 74c10-6 24-4 30 10-8 8-24 8-30-10z" fill="#d9c9a6" />
      <path d="M138 74c-10-6-24-4-30 10 8 8 24 8 30-10z" fill="#d9c9a6" />
      <rect x="88" y="150" width="24" height="44" rx="10" />
    </g>
  ),
  winged: (
    <g>
      <path d="M100 50c-30 0-60-30-96-20 20 30 30 80 60 90 10 4 20-6 36-6s26 10 36 6c30-10 40-60 60-90-36-10-66 20-96 20z" />
      <rect x="88" y="40" width="24" height="120" rx="12" />
      <circle cx="94" cy="56" r="4" fill="#8b1a17" />
      <circle cx="106" cy="56" r="4" fill="#8b1a17" />
    </g>
  ),
};
const SHAPE_BY_SLUG = {
  'et-de-varginha': 'alien', boitata: 'serpent', nessie: 'serpent', mothman: 'winged',
  ovni: 'saucer', alienigena: 'grey',
};

export function CryptidSilhouette({ slug }) {
  return (
    <svg viewBox="0 0 200 200" fill="#2b2118" aria-hidden="true">{SHAPES[SHAPE_BY_SLUG[slug] ?? 'humanoid']}</svg>
  );
}
