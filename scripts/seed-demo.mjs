#!/usr/bin/env node
/**
 * Publica os casos de demonstração PELO PRÓPRIO SITE, como um usuário faria:
 * testemunhas se cadastram → registram relatos → enviam fotos pelo upload seguro
 * (URL pré-assinada → quarentena → validação → sem EXIF) → o moderador verifica.
 *
 *   MOD_EMAIL=... MOD_PASSWORD=... node scripts/seed-demo.mjs http://localhost:8080
 *   MOD_EMAIL=... MOD_PASSWORD=... node scripts/seed-demo.mjs https://<alb> --insecure
 *
 * --insecure aceita o certificado autoassinado do ALB (só para este script).
 * Fotos ficam em docs/fotos-demo/; caso sem foto no disco é publicado sem foto.
 * Rodar de novo não duplica: casos com o mesmo título são pulados.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const [base, flag] = process.argv.slice(2);
if (!base) {
  console.error('uso: node scripts/seed-demo.mjs <url-do-site> [--insecure]');
  process.exit(1);
}
if (flag === '--insecure') process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { MOD_EMAIL, MOD_PASSWORD } = process.env;
if (!MOD_EMAIL || !MOD_PASSWORD) {
  console.error('Defina MOD_EMAIL e MOD_PASSWORD (o moderador criado pelo seed).');
  process.exit(1);
}

const API = `${base.replace(/\/$/, '')}/api`;
const PHOTOS = new URL('../docs/fotos-demo/', import.meta.url);

const WITNESSES = {
  trilha: 'Caçador de Trilhas',
  cida: 'Dona Cida',
  valdir: 'Seu Valdir',
  marcos: 'Marcos, estudante de biologia',
  joana: 'Joana Fazendeira',
};

const CASES = [
  {
    by: 'trilha', cryptid: 'pe-grande', credibility: 3, photo: 'pe-grande-trilha.jpg',
    title: 'Vulto enorme na trilha',
    description: 'Durante uma trilha no fim da tarde vi um vulto peludo de uns 2,5 m parado entre as árvores, me olhando. Quando apontei a lanterna ele virou de lado e sumiu no mato sem fazer barulho. Deixou um galho quebrado bem acima da minha cabeça.',
    city: 'Rio do Sul', uf: 'SC', latitude: -27.2142, longitude: -49.6431, seenAt: '2025-09-10',
  },
  {
    by: 'trilha', cryptid: 'pe-grande', credibility: 4, photo: 'camera-de-trilha.jpg',
    title: 'Câmera de trilha flagrou vulto às 3h',
    description: 'Instalei uma câmera de trilha perto do riacho para pegar capivaras. Às 3h14 ela disparou e registrou um vulto bípede, bem mais alto que uma pessoa, atravessando o riacho. No dia seguinte achei pegadas fundas na lama, com o dedão separado.',
    city: 'Urubici', uf: 'SC', latitude: -28.015, longitude: -49.592, seenAt: '2025-09-10',
  },
  {
    by: 'cida', cryptid: 'et-de-varginha', credibility: 5, photo: 'et-de-varginha.jpg',
    title: 'Criatura de olhos vermelhos no Jardim Andere',
    description: 'Voltando da padaria, vi uma criatura agachada encostada no muro da esquina. Pele marrom e oleosa, três calombos na cabeça e uns olhos vermelhos enormes. Ela não fez som nenhum. A câmera da loja da esquina pegou tudo.',
    city: 'Varginha', uf: 'MG', latitude: -21.5513, longitude: -45.4303, seenAt: '1996-01-20',
  },
  {
    by: 'valdir', cryptid: 'chupa-cabra', credibility: 3, photo: 'chupa-cabra.jpg',
    title: 'Cabras atacadas no sítio',
    description: 'A câmera do curral filmou um bicho magro, com espinhos nas costas, andando em duas patas. De manhã encontrei quatro cabras com dois furos no pescoço e nenhuma gota de sangue. Os cachorros passaram a noite inteira chorando.',
    city: 'Campina Grande', uf: 'PB', latitude: -7.2307, longitude: -35.8817, seenAt: '2024-08-14',
  },
  {
    by: 'marcos', cryptid: 'mapinguari', credibility: 4, photo: 'mapinguari.jpg',
    title: 'Rastro gigante perto do igarapé',
    description: 'Em campo de coleta, achamos uma pegada redonda de quase meio metro, afundada na lama do igarapé. Cheiro muito forte no ar. Os guias locais se recusaram a seguir o rastro e pediram para voltar antes de escurecer.',
    city: 'Tefé', uf: 'AM', latitude: -3.354, longitude: -64.711, seenAt: '2025-03-02',
  },
  {
    by: 'joana', cryptid: 'boitata', credibility: 2, photo: 'boitata.jpg',
    title: 'Luz serpenteando sobre o banhado',
    description: 'Uma luz azulada comprida, em forma de cobra, flutuou rente ao campo por uns dois minutos. Deixei a câmera aberta em exposição longa e ela registrou o rastro inteiro. Depois a luz desceu e sumiu no banhado.',
    city: 'Santa Maria', uf: 'RS', latitude: -29.6842, longitude: -53.8069, seenAt: '2025-06-21',
  },
  {
    by: 'valdir', cryptid: 'ovni', credibility: 4, photo: 'ovni-plantacao.jpg',
    title: 'Desenhos na soja amanheceram prontos',
    description: 'Às 2h acordei com um zumbido e luz branca entrando pela janela. Tinha um disco parado em cima da lavoura. De manhã a soja estava deitada formando círculos perfeitos, todos virados para o mesmo lado. Nenhum pé quebrado.',
    city: 'Cascavel', uf: 'PR', latitude: -24.9555, longitude: -53.4552, seenAt: '2025-11-02',
  },
  {
    by: 'joana', cryptid: 'ovni', credibility: 2, photo: 'abducao-vaca.jpg',
    title: 'A Mimosa subiu num facho de luz',
    description: 'A câmera do pasto mostra a Mimosa, nossa vaca mais velha, subindo devagar dentro de um facho de luz. Ela voltou três horas depois, no mesmo lugar, calma, e desde então só come capim do lado esquerdo do pasto.',
    city: 'Rio Verde', uf: 'GO', latitude: -17.7923, longitude: -50.9192, seenAt: '2025-07-18',
  },
  {
    by: 'marcos', cryptid: 'alienigena', credibility: 1, photo: 'et-churrasco.jpg',
    title: 'Ser cinzento levou a picanha da churrasqueira',
    description: 'Domingo, fim de tarde, todo mundo dentro de casa. A câmera do quintal gravou um ser cinzento de cabeça enorme pegando a picanha da grelha e saindo pelo muro. Deixou a farofa. Registro feito para fins de seguro.',
    city: 'Blumenau', uf: 'SC', latitude: -26.9194, longitude: -49.0661, seenAt: '2025-10-12',
  },
];

const COMMENTS = [
  ['Criatura de olhos vermelhos no Jardim Andere', 'cida', 'Até hoje ninguém no bairro fala disso em voz alta.'],
  ['Criatura de olhos vermelhos no Jardim Andere', 'marcos', 'O formato da cabeça bate com outros dois relatos da mesma semana.'],
  ['Câmera de trilha flagrou vulto às 3h', 'valdir', 'Moro perto e ouvi uivos naquela semana.'],
  ['Cabras atacadas no sítio', 'joana', 'Aconteceu igualzinho aqui no Goiás em 2019.'],
  ['Desenhos na soja amanheceram prontos', 'trilha', 'Vi luzes no céu na mesma madrugada, a uns 40 km dali.'],
  ['Ser cinzento levou a picanha da churrasqueira', 'joana', 'Pelo menos deixou a farofa.'],
];

// ---------- cliente HTTP com "sessão" por usuário ----------
function client() {
  let cookie = '';
  return async function call(method, path, body) {
    const res = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${data?.error ?? ''}`);
    return data;
  };
}

const mime = (file) => (file.endsWith('.png') ? 'image/png' : file.endsWith('.webp') ? 'image/webp' : 'image/jpeg');

async function uploadPhoto(call, sightingId, file) {
  const buf = await readFile(new URL(file, PHOTOS));
  const type = mime(file);
  const { photoId, upload } = await call('POST', `/sightings/${sightingId}/photos/upload-url`, { contentType: type });
  const form = new FormData();
  for (const [k, v] of Object.entries(upload.fields)) form.append(k, v);
  form.append('file', new Blob([buf], { type }), file);
  const s3 = await fetch(upload.url, { method: 'POST', body: form });
  if (!s3.ok) throw new Error(`upload no S3 → ${s3.status}`);
  await call('POST', `/photos/${photoId}/confirm`);
  return photoId;
}

// ---------- execução ----------
const mod = client();
await mod('POST', '/auth/login', { email: MOD_EMAIL, password: MOD_PASSWORD });
console.log('moderador conectado');

const cryptids = Object.fromEntries((await mod('GET', '/cryptids')).items.map((c) => [c.slug, c.id]));

const witnesses = {};
for (const [key, name] of Object.entries(WITNESSES)) {
  const call = client();
  const email = `${key}.${randomBytes(4).toString('hex')}@demo.cryptidwatch.local`;
  await call('POST', '/auth/register', { name, email, password: randomBytes(18).toString('base64url') });
  witnesses[key] = call;
}
console.log(`${Object.keys(witnesses).length} testemunhas cadastradas`);

const published = {};
for (const c of CASES) {
  const existing = await mod('GET', `/sightings?q=${encodeURIComponent(c.title)}&limit=5`);
  if (existing.items.some((s) => s.title === c.title)) {
    console.log(`= já existe: ${c.title}`);
    published[c.title] = existing.items.find((s) => s.title === c.title).id;
    continue;
  }
  if (!cryptids[c.cryptid]) {
    console.log(`! criatura ${c.cryptid} não existe na API (atualize a imagem da API): ${c.title}`);
    continue;
  }
  const call = witnesses[c.by];
  const { id } = await call('POST', '/sightings', {
    cryptidId: cryptids[c.cryptid], title: c.title, description: c.description,
    city: c.city, uf: c.uf, latitude: c.latitude, longitude: c.longitude, seenAt: c.seenAt,
  });

  let photoId = null;
  if (existsSync(new URL(c.photo, PHOTOS))) {
    photoId = await uploadPhoto(call, id, c.photo);
  }
  await mod('POST', `/moderation/sightings/${id}/approve`, { credibility: c.credibility });
  if (photoId) await mod('POST', `/moderation/photos/${photoId}/approve`);
  published[c.title] = id;
  console.log(`+ ${c.title}${photoId ? ' (com foto)' : ' (sem foto)'}`);
}

for (const [title, by, body] of COMMENTS) {
  if (!published[title]) continue;
  await witnesses[by]('POST', `/sightings/${published[title]}/comments`, { body }).catch(() => {});
}
console.log('depoimentos publicados. Pronto.');
