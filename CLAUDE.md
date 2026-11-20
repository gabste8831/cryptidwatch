# CryptidWatch — contexto do projeto

Trabalho final de "Auditoria e Segurança de Sistemas" (UNIDAVI, SI).
O diagrama de arquitetura (parte 1, 2 pontos) já foi entregue: `docs/arquitetura.jpg`.
Agora é a implementação completa na AWS.

## Avaliação
- 4 pontos: apresentação individual
- 4 pontos: desenvolvimento do trabalho

## Requisitos do professor (todos obrigatórios)
1. Fluxo de desenvolvimento completo, CI/CD com SAST (SonarCloud)
2. Desenvolvimento seguro com SDD e especificações de segurança (`/specs`)
3. Infra AWS 100% em Terraform (representa o plano de DR)
4. Segmentação de redes (bancos e serviços internos isolados)
5. Load balancer com WAF contra ataques de camada 7
6. Aplicação funcional e completa (não pode ser "Hello World")
7. Kubernetes (EKS)

## App
Registro de avistamentos de criptídeos (Pé-Grande, Chupa-cabra, ET de Varginha...).
Funcionalidades: relatar avistamento (criptídeo, local, data), upload de foto,
busca e filtros, ranking dos criptídeos (Redis), moderação de relatos,
login JWT + RBAC (`usuario` / `moderador`).

## Stack
- Frontend: React (Vite) servido por Nginx — `app/web`
- Backend: Node.js + Express — `app/api`
- Banco: PostgreSQL (RDS) | Cache: Redis (ElastiCache) | Fotos: S3 privado
- Orquestração: Amazon EKS — manifests em `k8s/`
- IaC: Terraform — `infra/terraform` (módulos: vpc, eks, alb-waf-acm, rds, redis, s3, ecr)
- CI/CD: GitHub Actions — `.github/workflows`

## Restrições do AWS Academy Learner Lab (us-east-1)
- Credenciais temporárias (~4h) nos GitHub Secrets (`AWS_ACCESS_KEY_ID`,
  `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`), atualizadas a cada sessão. Sem OIDC.
- Não dá para criar roles IAM: usar a **LabRole** existente (cluster e nós do EKS).
- Sem IRSA → sem AWS Load Balancer Controller: **o Terraform cria o ALB** e o target
  group aponta para os nós via **NodePort**.
- Sem domínio: HTTPS com certificado **autoassinado** importado no ACM.
- Custos: EKS, NAT, RDS, ElastiCache. Sempre `terraform destroy` depois de testar.

## Arquitetura
**Pipeline:** lint + testes → SAST SonarCloud (quality gate barra o merge) →
SCA (npm audit + Trivy) → build Docker → push ECR →
terraform plan (PR) / apply (main) → deploy (kubectl no EKS).

**Entrada:** usuário → WAF (managed rules SQLi, Common/XSS, KnownBadInputs +
rate limit por IP) → ALB (443 com ACM; 80 redireciona para 443;
`/` → web, `/api/*` → api).

**VPC 10.0.0.0/16, 2 AZs:**
- Públicas 10.0.1.0/24, 10.0.2.0/24: ALB e NAT Gateway
- Privadas de app 10.0.11.0/24, 10.0.12.0/24: nós do EKS, namespace `cryptidwatch`,
  Deployments `web` e `api`, NetworkPolicy default-deny + exceções (VPC CNI),
  VPC Endpoint S3 (gateway)
- Privadas de dados 10.0.21.0/24, 10.0.22.0/24, sem rota para internet: RDS e Redis
- SGs em cadeia: SG-ALB (80/443 da internet) → SG-Nós (só do SG-ALB, sem SSH,
  sem IP público) → SG-Dados (5432/6379 só do SG-Nós)
- Criptografia em repouso e em trânsito no RDS e no Redis

**Fora da VPC:** ECR (scan on push), Secrets Manager (senha do banco, token do Redis),
S3 de fotos, CloudWatch (logs da app e do WAF + alarmes), S3 do estado do Terraform
(versionado e criptografado), LabRole, ACM.

## Fluxo de fotos
1. API confere login e dono do avistamento, gera URL pré-assinada de POST: expira em
   poucos minutos, `content-length-range` até 5 MB, só jpeg/png/webp,
   chave `quarentena/<uuid>` definida pela API.
2. Navegador envia direto ao S3 (não passa pelo ALB/WAF).
3. `/confirm`: API checa magic bytes, reprocessa com `sharp` (tira EXIF, neutraliza
   poliglota), gera miniatura, grava `aprovadas/<uuid>.webp`, apaga a quarentena.
4. Foto fica `pendente` até o moderador aprovar. Exibida por URL pré-assinada de GET
   (~5 min). SVG proibido. Banco guarda só metadados (chave, SHA-256, tipo, tamanho, status).

## SDD
`/specs`: uma spec por feature com requisitos SEC-xx numerados, ameaças (STRIDE) e
critérios de aceite que viram testes. Testes devem citar o SEC-xx no nome
(ex.: `it('SEC-01: ...')`) para rastreabilidade.

## Ambiente local (Windows)
- Instalados: git, Node 24, Docker. **Faltam:** Terraform e AWS CLI.
- Pasta fica fora do OneDrive de propósito (node_modules/.terraform quebram a sincronização).
- `docker compose up -d postgres redis s3 s3-init` sobe as dependências. Portas no host:
  Postgres **5433** e Redis **6380** (5432/6379 estão ocupadas por serviços instalados no
  Windows), S3 local (SeaweedFS) **8333**.
- `docker compose --profile app up -d --build` sobe também API e web em containers:
  site em http://localhost:8080.
- S3 local = SeaweedFS (MinIO e LocalStack não têm mais imagem gratuita). Precisa da
  identidade em `app/api/dev/s3.json` para aceitar URLs assinadas e não aceita o cabeçalho
  SSE (por isso `storage.js` só manda SSE quando não há `S3_ENDPOINT`).
- Docker Desktop pode estar fechado: abra antes de rodar o compose.
- Dev sem containers: `npm run dev` em `app/api` (usa `.env`, porta 3000) e em `app/web`
  (Vite 5173, proxy de /api). Moderador local: ver `SEED_MODERATOR_*` no `.env`.

## Frontend (`app/web`) — pronto
- Direção visual: "arquivo confidencial" (dossiê, máquina de escrever, carimbos, tarjas)
  + pôster de mundo aberto ao pôr do sol (tipografia condensada Anton, degradê laranja/rosa/roxo,
  estrelas de "procurado" = credibilidade, minimapa redondo tipo radar, cartazes de "procura-se",
  toast tipo mensagem de celular, faixa de "missão cumprida"). Tudo original: nada de logo,
  fonte ou arte de jogo existente.
- React 19 + react-router 7 + Leaflet (tiles OSM escurecidos por CSS) + lucide-react.
  Fontes via @fontsource (sem CDN, CSP fechada).
- Nginx `nginx-unprivileged` com CSP/HSTS etc. em `app/web/nginx/default.conf.template`
  (envsubst de `PHOTO_ORIGIN` e `API_UPSTREAM`).

## API (`app/api`) — pronta
- ESM, Express 5, zod 4, sharp 0.35, vitest 5. Dependências injetadas em `createApp(deps)`:
  testes usam Postgres real (`cryptidwatch_test`) + S3/Redis em memória.
- 69 testes, `npm audit` limpo, ESLint com eslint-plugin-security.
- Comentários com denúncia (3 denúncias ocultam) e credibilidade 1–5 dada na aprovação.
- Moderador só via `npm run seed` (SEED_MODERATOR_EMAIL/PASSWORD).
- Segredos em produção: `APP_SECRET_ID` → JSON no Secrets Manager com
  `JWT_SECRET`, `DB_PASSWORD`, `REDIS_AUTH_TOKEN`.

## Próximos passos
1. ~~Estrutura do repo + specs~~
2. ~~API (Express) + testes~~
3. ~~Web (React) + Dockerfiles + docker-compose para rodar local~~
4. Terraform: backend S3, VPC, EKS, ALB+WAF+ACM, RDS, Redis, S3, ECR
5. Manifests k8s + NetworkPolicy
6. Workflow do GitHub Actions + SonarCloud
7. Testar o WAF (SQLi/XSS → 403) e juntar evidências para a apresentação
