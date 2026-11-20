# CryptidWatch API

Node.js 22+ · Express 5 · PostgreSQL · Redis · S3. Cada requisito de segurança das
[specs](../../specs/README.md) tem teste com o ID no nome (`SEC-xx`).

## Rodar local

```bash
docker compose up -d          # na raiz do repo: Postgres (5433), Redis, MinIO
cd app/api
cp .env.example .env          # ajuste JWT_SECRET
npm install
npm run seed                  # cria o moderador e relatos de demonstração
npm run dev                   # http://localhost:3000/api/health
```

## Testes

```bash
npm test                      # precisa do Postgres do docker compose
npm run test:coverage         # gera coverage/lcov.info para o SonarCloud
npm run lint                  # ESLint + eslint-plugin-security
```

## Rotas

| Método | Rota | Acesso |
|---|---|---|
| POST | `/api/auth/register` · `/login` · `/logout` | público (rate limit) |
| GET | `/api/auth/me` | logado |
| GET | `/api/cryptids` · `/api/ranking` | público |
| GET | `/api/sightings?q&cryptid&uf&from&to&sort&order&page&limit` | público (só aprovados) |
| GET | `/api/sightings/mine` | logado |
| GET | `/api/sightings/:id` | aprovado: público; senão autor/moderador |
| POST | `/api/sightings` | logado (10/h) |
| PATCH/DELETE | `/api/sightings/:id` | autor, enquanto pendente |
| POST | `/api/sightings/:id/photos/upload-url` | autor |
| POST | `/api/photos/:id/confirm` | dono da foto |
| GET | `/api/photos/:id/url?variant=thumb\|full` | aprovada: público; senão dono/moderador |
| GET | `/api/moderation/queue` · `/audit` | moderador |
| POST | `/api/moderation/{sightings\|photos}/:id/{approve\|reject}` | moderador |
| GET | `/api/health` · `/api/health/ready` | health check do ALB / Kubernetes |
