/* Ilustrações originais em SVG: pôr do sol com serra, pinheiros e um vulto na mata. */

function Pines({ y, color, count, height, seed = 1 }) {
  const trees = [];
  for (let i = 0; i < count; i += 1) {
    const x = (i / count) * 1600 + ((i * 97 * seed) % 40);
    const h = height * (0.7 + (((i * 53 * seed) % 30) / 100));
    trees.push(`M${x} ${y} L${x + h * 0.22} ${y - h} L${x + h * 0.44} ${y} Z`);
  }
  return <path d={trees.join(' ')} fill={color} />;
}

// Vulto bípede andando, braço balançando: a pose clássica dos filmes de avistamento.
const SQUATCH = `M58 4c9 0 15 7 15 16 0 4-1 7-3 10 9 3 15 10 17 20l6 30c1 5-2 9-6 9-3 0-5-2-6-5l-6-24-2 30
  5 40c1 6-3 10-8 10s-8-3-9-8l-5-34-4 34c-1 5-4 8-9 8s-9-4-8-10l5-42-1-28-8 20c-1 3-4 5-7 4-4-1-6-5-5-9l9-28
  c3-9 9-15 17-17-2-3-3-7-3-11 0-9 6-15 14-15z`;

export function Squatch({ fill = '#000', ...props }) {
  return (
    <svg viewBox="0 0 110 200" aria-hidden="true" {...props}>
      <path d={SQUATCH} fill={fill} />
    </svg>
  );
}

export function SunsetScene({ figure = true }) {
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b1a6b" />
          <stop offset="0.35" stopColor="#b8306f" />
          <stop offset="0.62" stopColor="#ff6a3d" />
          <stop offset="0.8" stopColor="#ffb547" />
        </linearGradient>
        <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2b0" />
          <stop offset="1" stopColor="#ff9b3d" />
        </linearGradient>
        <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="2" fill="rgba(0,0,0,0.12)" />
        </pattern>
      </defs>
      <rect width="1600" height="900" fill="url(#sky)" />
      <circle cx="1120" cy="560" r="230" fill="url(#sun)" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x="860" y={600 + i * 26} width="520" height={6 + i * 3} fill="#ffb547" opacity="0.9" />
      ))}
      <path d="M0 640 L180 520 L320 600 L470 470 L640 590 L800 500 L980 610 L1130 520 L1300 600 L1460 500 L1600 560 V900 H0Z" fill="#6b2457" opacity="0.85" />
      <path d="M0 700 L140 620 L300 690 L420 610 L600 700 L760 640 L900 710 L1080 640 L1240 720 L1400 650 L1600 700 V900 H0Z" fill="#3e1640" />
      <Pines y={760} color="#22102a" count={40} height={170} />
      <Pines y={860} color="#120914" count={26} height={260} seed={3} />
      {figure && (
        <g transform="translate(1040 540) scale(1.5)">
          <path d={SQUATCH} fill="#0b0610" />
        </g>
      )}
      <rect y="830" width="1600" height="70" fill="#0e0d0b" />
      <rect width="1600" height="900" fill="url(#scan)" />
    </svg>
  );
}

/* Silhuetas simples para os cartazes de "procurado". */
const SHAPES = {
  humanoid: <path d={SQUATCH} transform="translate(27 6) scale(1.3)" />,
  alien: (
    <g>
      <ellipse cx="100" cy="70" rx="46" ry="58" />
      <rect x="84" y="118" width="32" height="70" rx="12" />
      <ellipse cx="82" cy="70" rx="14" ry="20" fill="#d7b877" />
      <ellipse cx="118" cy="70" rx="14" ry="20" fill="#d7b877" />
      <circle cx="82" cy="74" r="6" fill="#b02a1a" />
      <circle cx="118" cy="74" r="6" fill="#b02a1a" />
    </g>
  ),
  serpent: <path d="M20 150c30-60 60 20 90-30s50-40 60-80c5-20 20-20 22 0 2 15-8 20-14 40-12 44-48 50-70 86s-60 30-88-16z" />,
  winged: (
    <g>
      <path d="M100 50c-30 0-60-30-96-20 20 30 30 80 60 90 10 4 20-6 36-6s26 10 36 6c30-10 40-60 60-90-36-10-66 20-96 20z" />
      <rect x="88" y="40" width="24" height="120" rx="12" />
      <circle cx="94" cy="56" r="4" fill="#b02a1a" />
      <circle cx="106" cy="56" r="4" fill="#b02a1a" />
    </g>
  ),
};
const SHAPE_BY_SLUG = {
  'et-de-varginha': 'alien', boitata: 'serpent', nessie: 'serpent', mothman: 'winged',
};

export function CryptidSilhouette({ slug }) {
  const shape = SHAPES[SHAPE_BY_SLUG[slug] ?? 'humanoid'];
  return (
    <svg viewBox="0 0 200 200" fill="#d7b877" aria-hidden="true">{shape}</svg>
  );
}

export function LogoMark(props) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" {...props}>
      <circle cx="32" cy="32" r="22" fill="none" stroke="#ff7a3d" strokeWidth="4" />
      <circle cx="32" cy="32" r="12" fill="none" stroke="#ff3d7f" strokeWidth="3" strokeDasharray="4 4" />
      <circle cx="32" cy="32" r="5" fill="#ece3cb" />
      <path d="M32 2v12M32 50v12M2 32h12M50 32h12" stroke="#ece3cb" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
