# 05 — Ranking de criptídeos

## Feature
Página pública com os criptídeos mais avistados (só relatos aprovados), usando
sorted set no Redis (`ZINCRBY` na aprovação). Redis também guarda contadores de rate limit.

## Requisitos
| ID | Requisito |
|---|---|
| SEC-50 | Ranking só é incrementado na aprovação pelo moderador, nunca na criação (evita inflar ranking com spam). |
| SEC-51 | Conexão com o Redis usa TLS e AUTH token do Secrets Manager; Redis só acessível pelo SG-Nós. |
| SEC-52 | Se o Redis cair, o ranking é recalculado do PostgreSQL e o rate limit falha fechado no login (nega em vez de liberar). |

## Ameaças (STRIDE)
| Ameaça | Cenário | Mitigação |
|---|---|---|
| **T**ampering | Inflar o ranking criando relatos falsos | SEC-50, SEC-02 |
| **I**nformation disclosure | Sniffing do tráfego até o Redis | SEC-51 |
| **D**enial of service | Derrubar o Redis para burlar rate limit | SEC-52 |

## Critérios de aceite
- [ ] SEC-50: criar relato não muda o ranking; aprovar incrementa em 1.
- [ ] SEC-52: com Redis indisponível, `GET /api/ranking` responde com dados do banco.
