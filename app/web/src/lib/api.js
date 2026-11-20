import { useCallback, useEffect, useState } from 'react';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/**
 * Cliente da API. Mesma origem (o Nginx/ALB manda /api para a API), então o cookie
 * HttpOnly vai sozinho e o JavaScript nunca toca no token (SEC-13 / SEC-102).
 */
async function request(method, path, body) {
  const init = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor. Tente de novo.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, friendlyError(res.status, data.error), data.details);
  return data;
}

function friendlyError(status, msg) {
  if (status === 429) return 'Muitas tentativas. Espere um pouco e tente de novo.';
  if (status === 403 && !msg) return 'Você não tem permissão para isso.';
  if (status >= 500) return 'Algo deu errado do nosso lado. Tente de novo em instantes.';
  return msg || 'Não foi possível concluir a ação.';
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body = {}) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
};

export function qs(params) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : '';
}

export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * Upload em 3 passos (specs/03): URL pré-assinada → envio direto ao S3 → confirmação.
 * A checagem de tipo/tamanho aqui é só conforto; quem decide é a API.
 */
export async function uploadPhoto(sightingId, file) {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) throw new ApiError(415, 'Use JPEG, PNG ou WEBP.');
  if (file.size > MAX_PHOTO_BYTES) throw new ApiError(413, 'A foto passa de 5 MB.');
  const { photoId, upload } = await api.post(`/sightings/${sightingId}/photos/upload-url`, { contentType: file.type });
  const form = new FormData();
  for (const [k, v] of Object.entries(upload.fields)) form.append(k, v);
  form.append('file', file); // o arquivo precisa ser o último campo do POST do S3
  const res = await fetch(upload.url, { method: 'POST', body: form });
  if (!res.ok) throw new ApiError(res.status, 'O armazenamento recusou o arquivo.');
  return api.post(`/photos/${photoId}/confirm`);
}

/** Busca dados de um GET da API; `reload()` busca de novo. */
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!path) return undefined;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api.get(path).then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (error) => alive && setState({ data: null, error, loading: false }),
    );
    return () => { alive = false; };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
