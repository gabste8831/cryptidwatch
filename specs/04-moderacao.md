# 04 — Moderação

## Feature
Moderadores veem a fila de relatos e fotos `pendente` e aprovam ou rejeitam
(com motivo). Toda decisão fica registrada.

## Requisitos
| ID | Requisito |
|---|---|
| SEC-03 | Rotas `/api/moderation/*` exigem papel `moderador`, checado no middleware a partir do banco (não só do token). |
| SEC-40 | Cada decisão grava log de auditoria imutável: moderador, item, ação, motivo, data/hora, IP. Sem rota de edição/exclusão. |
| SEC-41 | Moderador não modera os próprios relatos (segregação de funções). |
| SEC-42 | Motivo de rejeição obrigatório (≤ 500 caracteres) e visível ao autor. |

## Ameaças (STRIDE)
| Ameaça | Cenário | Mitigação |
|---|---|---|
| **E**levation of privilege | Usuário comum chama a rota de aprovação | SEC-03 |
| **E**levation of privilege | Token antigo de ex-moderador | SEC-03 (papel lido do banco) |
| **R**epudiation | Moderador nega ter aprovado conteúdo | SEC-40 |
| **T**ampering | Moderador aprova o próprio relato | SEC-41 |

## Critérios de aceite
- [ ] SEC-03: `usuario` em `POST /api/moderation/sightings/:id/approve` → 403.
- [ ] SEC-03: moderador rebaixado no banco, com token ainda válido → 403.
- [ ] SEC-40: aprovação cria linha em `audit_log` com moderador e IP.
- [ ] SEC-41: moderador aprovando o próprio relato → 403.
- [ ] SEC-42: rejeitar sem motivo → 400.
