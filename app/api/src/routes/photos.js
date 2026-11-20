import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { HttpError, notFound } from '../errors.js';
import { detectImageType, processImage, sha256 } from '../images.js';
import { uploadUrlSchema, photoVariantQuery, uuidParam } from '../validation.js';

export function photoRoutes({ db, config, storage }) {
  const router = Router();
  const { upload } = config;

  // Passo 1: URL pré-assinada para o navegador enviar direto ao S3.
  router.post('/sightings/:id/photos/upload-url', requireAuth, async (req, res) => {
    const id = uuidParam.safeParse(req.params.id);
    if (!id.success) throw notFound();
    const { contentType } = uploadUrlSchema.parse(req.body);

    // SEC-32: só o autor, e o relato não pode estar rejeitado.
    const { rows } = await db.query(
      `SELECT id FROM sightings WHERE id = $1 AND author_id = $2 AND status <> 'rejeitado'`,
      [id.data, req.user.id],
    );
    if (!rows[0]) throw notFound();

    // Uploads abandonados há mais de 10 minutos não contam no limite.
    const { rows: [{ total }] } = await db.query(
      `SELECT COUNT(*)::int AS total FROM photos
        WHERE sighting_id = $1 AND status <> 'rejeitado'
          AND (status <> 'aguardando_upload' OR created_at > now() - interval '10 minutes')`,
      [id.data],
    );
    if (total >= upload.maxPhotosPerSighting) {
      throw new HttpError(409, `limite de ${upload.maxPhotosPerSighting} fotos por relato`);
    }

    // SEC-31: a chave é gerada aqui; o cliente não escolhe nome nem caminho.
    const { rows: [photo] } = await db.query(
      `INSERT INTO photos (sighting_id, owner_id, mime) VALUES ($1, $2, $3) RETURNING id`,
      [id.data, req.user.id, contentType],
    );
    const key = `quarentena/${photo.id}`;
    await db.query('UPDATE photos SET object_key = $1 WHERE id = $2', [key, photo.id]);

    const post = await storage.presignUpload(key, {
      contentType, maxBytes: upload.maxBytes, expiresSec: upload.uploadUrlExpiresSec,
    });
    res.status(201).json({ photoId: photo.id, upload: post, expiresIn: upload.uploadUrlExpiresSec });
  });

  // Passo 2: depois do upload, a API valida e reprocessa o arquivo.
  router.post('/photos/:id/confirm', requireAuth, async (req, res) => {
    const id = uuidParam.safeParse(req.params.id);
    if (!id.success) throw notFound();
    const { rows } = await db.query(
      `SELECT id, object_key FROM photos WHERE id = $1 AND owner_id = $2 AND status = 'aguardando_upload'`,
      [id.data, req.user.id],
    );
    const photo = rows[0];
    if (!photo) throw notFound();
    const quarantineKey = photo.object_key;

    const reject = async (status, message) => {
      await storage.deleteObject(quarantineKey).catch(() => {});
      await db.query(
        `UPDATE photos SET status = 'rejeitado', object_key = NULL, reject_reason = $2 WHERE id = $1`,
        [photo.id, message],
      );
      req.log?.warn({ photoId: photo.id, motivo: message }, 'upload rejeitado na validação');
      throw new HttpError(status, message);
    };

    const obj = await storage.getObject(quarantineKey, upload.maxBytes);
    if (!obj) throw new HttpError(400, 'arquivo ainda não foi enviado');
    if (obj.tooLarge) await reject(413, 'arquivo maior que 5 MB');

    // SEC-04: magic bytes. SVG, HTML, PDF etc. caem aqui.
    const detected = detectImageType(obj.body);
    if (!detected) await reject(415, 'formato não permitido (só JPEG, PNG ou WEBP)');

    // SEC-33: re-encode sem metadados.
    let processed;
    try {
      processed = await processImage(obj.body, { maxDimension: upload.maxDimension });
    } catch (err) {
      await reject(err.status ?? 422, err.message);
    }

    const fullKey = `aprovadas/${photo.id}.webp`;
    const thumbKey = `aprovadas/${photo.id}_thumb.webp`;
    await storage.putObject(fullKey, processed.full, 'image/webp');
    await storage.putObject(thumbKey, processed.thumb, 'image/webp');
    await storage.deleteObject(quarantineKey);

    // SEC-36: só metadados no banco; SHA-256 do arquivo original como evidência.
    await db.query(
      `UPDATE photos SET status = 'pendente', object_key = $2, thumb_key = $3, sha256 = $4,
              mime = $5, size_bytes = $6, width = $7, height = $8
        WHERE id = $1`,
      [photo.id, fullKey, thumbKey, sha256(obj.body), detected, obj.body.length, processed.width, processed.height],
    );
    res.json({ id: photo.id, status: 'pendente', width: processed.width, height: processed.height });
  });

  // SEC-35: URL de leitura de 5 min; pendente/rejeitada só para o dono e moderadores.
  router.get('/photos/:id/url', async (req, res) => {
    const id = uuidParam.safeParse(req.params.id);
    if (!id.success) throw notFound();
    const { variant } = photoVariantQuery.parse(req.query);
    const { rows } = await db.query(
      `SELECT p.status, p.owner_id, p.object_key, p.thumb_key, s.status AS sighting_status
         FROM photos p JOIN sightings s ON s.id = p.sighting_id
        WHERE p.id = $1 AND p.thumb_key IS NOT NULL`,
      [id.data],
    );
    const p = rows[0];
    const isPublic = p && p.status === 'aprovado' && p.sighting_status === 'aprovado';
    const allowed = p && (isPublic || req.user?.id === p.owner_id || req.user?.role === 'moderador');
    if (!allowed) throw notFound();
    const key = variant === 'thumb' ? p.thumb_key : p.object_key;
    res.json({ url: await storage.presignGet(key, upload.getUrlExpiresSec), expiresIn: upload.getUrlExpiresSec });
  });

  return router;
}
