# 09 — Frontend (React + Nginx)

## Feature
SPA em React servida por Nginx sem root. Fala só com a própria origem (`/api`), envia
fotos direto ao bucket por URL pré-assinada e mostra mapas com tiles do OpenStreetMap.

## Requisitos
| ID | Requisito |
|---|---|
| SEC-100 | Nginx envia CSP restritiva (`script-src 'self'`, sem `unsafe-eval`, `object-src 'none'`, `frame-ancestors 'none'`), além de HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` e `Permissions-Policy`. Fontes servidas pelo próprio site (sem CDN). |
| SEC-101 | Conteúdo do usuário só é renderizado como texto (React escapa). `dangerouslySetInnerHTML` é proibido pelo lint (`react/no-danger`). |
| SEC-102 | O token de sessão nunca é acessível ao JavaScript (cookie HttpOnly); nada de token em `localStorage`. |
| SEC-103 | Redirecionamento pós-login só para caminhos internos (`/...`), bloqueando open redirect via `?voltar=`. |
| SEC-104 | Imagem do container: build multi-stage, só os estáticos no Nginx `nginx-unprivileged` (usuário 101), sem source maps em produção, `server_tokens off`, arquivos ocultos bloqueados. |

## Ameaças (STRIDE)
| Ameaça | Cenário | Mitigação |
|---|---|---|
| **T**ampering | XSS armazenado executa no navegador | SEC-101, SEC-100 (CSP bloqueia script inline mesmo se escapar) |
| **I**nformation disclosure | Roubo de sessão por XSS | SEC-102 |
| **S**poofing | Clickjacking da tela de moderação | SEC-100 (`frame-ancestors 'none'`) |
| **S**poofing | Link de login que redireciona para phishing | SEC-103 |
| **E**levation of privilege | Container do web comprometido vira root | SEC-104 |

## Critérios de aceite
- [ ] SEC-100: `curl -I` no site mostra a CSP e os demais cabeçalhos; nenhuma violação de CSP no console.
- [ ] SEC-101: comentário `<script>alert(1)</script>` aparece como texto na página.
- [ ] SEC-102: `document.cookie` no console não mostra `cw_session`.
- [ ] SEC-103: `/entrar?voltar=https://evil.example` volta para `/` após o login.
- [ ] SEC-104: `docker compose exec web whoami` → `nginx`.
