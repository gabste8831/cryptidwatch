import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { detectImageType } from '../src/images.js';
import { buildTestApp, cookieFor, createSighting, createUser, getDb, makeJpeg, makePng, resetDb } from './helpers.js';

describe('Upload de fotos (specs/03-upload-fotos.md)', () => {
  let app;
  let storage;
  let author;
  let sightingId;

  beforeEach(async () => {
    await resetDb();
    ({ app, storage } = await buildTestApp());
    author = await createUser();
    sightingId = await createSighting(author);
  });

  /** Simula o fluxo do navegador: pede a URL, "envia" ao S3 e confirma. */
  async function uploadAndConfirm(buffer, { contentType = 'image/jpeg', user = author } = {}) {
    const urlRes = await request(app).post(`/api/sightings/${sightingId}/photos/upload-url`)
      .set('Cookie', cookieFor(user)).send({ contentType });
    if (urlRes.status !== 201) return urlRes;
    await storage.putObject(urlRes.body.upload.fields.key, buffer);
    return request(app).post(`/api/photos/${urlRes.body.photoId}/confirm`).set('Cookie', cookieFor(user));
  }

  it('fluxo completo: foto válida vira WEBP pendente e a quarentena é apagada', async () => {
    const res = await uploadAndConfirm(await makeJpeg());
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pendente');
    const keys = [...storage.objects.keys()];
    expect(keys.some((k) => k.startsWith('quarentena/'))).toBe(false);
    expect(keys).toEqual(expect.arrayContaining([`aprovadas/${res.body.id}.webp`, `aprovadas/${res.body.id}_thumb.webp`]));
  });

  it('SEC-04: detecção por magic bytes', async () => {
    expect(detectImageType(await makeJpeg())).toBe('image/jpeg');
    expect(detectImageType(await makePng())).toBe('image/png');
    expect(detectImageType(await sharp(await makePng()).webp().toBuffer())).toBe('image/webp');
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectImageType(Buffer.from('GIF89a'))).toBeNull();
  });

  it('SEC-04: SVG enviado como PNG é recusado (415)', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const res = await uploadAndConfirm(svg, { contentType: 'image/png' });
    expect(res.status).toBe(415);
    expect(storage.objects.size).toBe(0); // quarentena apagada
  });

  it('SEC-04: tipo fora da lista nem recebe URL de upload', async () => {
    const res = await request(app).post(`/api/sightings/${sightingId}/photos/upload-url`)
      .set('Cookie', cookieFor(author)).send({ contentType: 'image/svg+xml' });
    expect(res.status).toBe(400);
  });

  it('SEC-04/SEC-33: arquivo poliglota (PNG + HTML) sai como WEBP limpo', async () => {
    const polyglot = Buffer.concat([await makePng(), Buffer.from('<html><script>alert(document.cookie)</script></html>')]);
    const res = await uploadAndConfirm(polyglot, { contentType: 'image/jpeg' });
    expect(res.status).toBe(200);
    const out = storage.objects.get(`aprovadas/${res.body.id}.webp`);
    expect(detectImageType(out)).toBe('image/webp');
    expect(out.includes(Buffer.from('<script>'))).toBe(false);
  });

  it('SEC-31: a chave do objeto é definida pela API', async () => {
    const res = await request(app).post(`/api/sightings/${sightingId}/photos/upload-url`)
      .set('Cookie', cookieFor(author)).send({ contentType: 'image/png', key: '../../etc/passwd' });
    expect(res.status).toBe(400);
    const ok = await request(app).post(`/api/sightings/${sightingId}/photos/upload-url`)
      .set('Cookie', cookieFor(author)).send({ contentType: 'image/png' });
    expect(ok.body.upload.fields.key).toBe(`quarentena/${ok.body.photoId}`);
  });

  it('SEC-32: outro usuário não envia foto para o relato', async () => {
    const intruder = await createUser();
    const res = await request(app).post(`/api/sightings/${sightingId}/photos/upload-url`)
      .set('Cookie', cookieFor(intruder)).send({ contentType: 'image/png' });
    expect(res.status).toBe(404);
  });

  it('SEC-32: no máximo 3 fotos por relato', async () => {
    for (let i = 0; i < 3; i += 1) expect((await uploadAndConfirm(await makePng())).status).toBe(200);
    const fourth = await request(app).post(`/api/sightings/${sightingId}/photos/upload-url`)
      .set('Cookie', cookieFor(author)).send({ contentType: 'image/png' });
    expect(fourth.status).toBe(409);
  });

  it('SEC-33: EXIF (inclusive GPS) é removido', async () => {
    const withExif = await makeJpeg({
      exif: { IFD0: { Make: 'CameraSecreta', Copyright: 'Fulano' }, IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '27/1 12/1 0/1' } },
    });
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const res = await uploadAndConfirm(withExif);
    const out = storage.objects.get(`aprovadas/${res.body.id}.webp`);
    const meta = await sharp(out).metadata();
    expect(meta.exif).toBeUndefined();
    expect(out.includes(Buffer.from('CameraSecreta'))).toBe(false);
  });

  it('SEC-33: imagem acima de 4096x4096 é recusada', async () => {
    const huge = await sharp({ create: { width: 5000, height: 10, channels: 3, background: '#000' } }).png().toBuffer();
    const res = await uploadAndConfirm(huge, { contentType: 'image/png' });
    expect(res.status).toBe(422);
  });

  it('SEC-35: foto pendente não é vista por anônimos; o dono vê', async () => {
    const res = await uploadAndConfirm(await makePng());
    const anon = await request(app).get(`/api/photos/${res.body.id}/url`);
    expect(anon.status).toBe(404);
    const own = await request(app).get(`/api/photos/${res.body.id}/url`).set('Cookie', cookieFor(author));
    expect(own.status).toBe(200);
    expect(own.body.expiresIn).toBe(300);
  });

  it('SEC-36: banco guarda SHA-256 e metadados, não o arquivo', async () => {
    const res = await uploadAndConfirm(await makePng());
    const db = await getDb();
    const { rows } = await db.query('SELECT * FROM photos WHERE id = $1', [res.body.id]);
    expect(rows[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].mime).toBe('image/png');
    expect(rows[0].size_bytes).toBeGreaterThan(0);
  });
});
