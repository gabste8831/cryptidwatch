import crypto from 'node:crypto';
import sharp from 'sharp';
import { HttpError } from './errors.js';

export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * SEC-04: o tipo é decidido pelos primeiros bytes do arquivo, não pela extensão nem
 * pelo Content-Type informado pelo cliente. Qualquer outra coisa (SVG, HTML, PDF...)
 * retorna null.
 */
export function detectImageType(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/**
 * SEC-33: decodifica e re-encoda como WEBP. O resultado é uma imagem nova, então:
 * - metadados (EXIF com GPS) não são copiados (o sharp descarta por padrão);
 * - bytes extras de um arquivo poliglota (HTML/JS colado no fim) não sobrevivem;
 * - limitInputPixels barra "decompression bombs" antes de alocar memória.
 */
export async function processImage(buf, { maxDimension }) {
  const opts = { limitInputPixels: maxDimension * maxDimension, failOn: 'error' };
  let meta;
  try {
    meta = await sharp(buf, opts).metadata();
  } catch {
    throw new HttpError(422, 'imagem corrompida ou grande demais');
  }
  if (!meta.width || !meta.height || meta.width > maxDimension || meta.height > maxDimension) {
    throw new HttpError(422, `imagem maior que ${maxDimension}x${maxDimension}`);
  }
  try {
    const full = await sharp(buf, opts)
      .rotate() // aplica a orientação do EXIF antes de descartá-lo
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    const thumb = await sharp(buf, opts)
      .rotate()
      .resize({ width: 320, height: 320, fit: 'cover' })
      .webp({ quality: 75 })
      .toBuffer();
    return { full: full.data, thumb, width: full.info.width, height: full.info.height };
  } catch {
    throw new HttpError(422, 'não foi possível processar a imagem');
  }
}
