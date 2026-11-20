import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const notFound = (msg = 'não encontrado') => new HttpError(404, msg);

/**
 * SEC-05: o cliente nunca recebe stack trace nem detalhe do banco. Erros inesperados
 * viram uma resposta genérica com o ID da requisição, que aparece no log do CloudWatch.
 */
export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'dados inválidos',
      details: err.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'requisição grande demais' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (err.code === '23503') return res.status(400).json({ error: 'referência inválida' });
  if (err.code === '23505') return res.status(409).json({ error: 'registro já existe' });

  req.log?.error({ err }, 'erro não tratado');
  return res.status(500).json({ error: 'erro interno', requestId: req.id });
}
