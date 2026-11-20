import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Acesso ao bucket privado de fotos (SEC-34). O bucket não tem nada público:
 * o navegador só lê e escreve por URL pré-assinada de curta duração.
 */
export function createS3Storage({ bucket, region, endpoint, publicEndpoint }) {
  if (!bucket) throw new Error('S3_BUCKET não configurado');
  const base = { region, ...(endpoint ? { endpoint, forcePathStyle: true } : {}) };
  const s3 = new S3Client(base);
  // As URLs assinadas precisam do host que o navegador acessa (no MinIO local é diferente do interno).
  const signer = publicEndpoint ? new S3Client({ ...base, endpoint: publicEndpoint }) : s3;

  return {
    // SEC-30 / SEC-31: chave, tipo e tamanho máximo ficam presos na política assinada.
    async presignUpload(key, { contentType, maxBytes, expiresSec }) {
      return createPresignedPost(signer, {
        Bucket: bucket,
        Key: key,
        Conditions: [
          ['content-length-range', 1, maxBytes],
          ['eq', '$Content-Type', contentType],
        ],
        Fields: { 'Content-Type': contentType },
        Expires: expiresSec,
      });
    },

    async getObject(key, maxBytes) {
      let head;
      try {
        head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      } catch (err) {
        if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) return null;
        throw err;
      }
      if (head.ContentLength > maxBytes) return { tooLarge: true };
      const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return { body: Buffer.from(await res.Body.transformToByteArray()) };
    },

    async putObject(key, body, contentType) {
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Na AWS o bucket também tem criptografia padrão (Terraform, SEC-34). O S3 local
        // (SeaweedFS) não aceita esse cabeçalho, então só vai quando é o S3 de verdade.
        ...(endpoint ? {} : { ServerSideEncryption: 'AES256' }),
      }));
    },

    async deleteObject(key) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },

    async presignGet(key, expiresSec) {
      return getSignedUrl(signer, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: expiresSec });
    },
  };
}

/** Implementação em memória para os testes. */
export function createMemoryStorage() {
  const objects = new Map();
  return {
    objects,
    async presignUpload(key, { contentType }) {
      return { url: 'memory://upload', fields: { key, 'Content-Type': contentType } };
    },
    async getObject(key, maxBytes) {
      const body = objects.get(key);
      if (!body) return null;
      if (body.length > maxBytes) return { tooLarge: true };
      return { body };
    },
    async putObject(key, body) {
      objects.set(key, Buffer.from(body));
    },
    async deleteObject(key) {
      objects.delete(key);
    },
    async presignGet(key, expiresSec) {
      return `memory://get/${key}?expires=${expiresSec}`;
    },
  };
}
