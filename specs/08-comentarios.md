# 08 — Comentários e denúncias

## Feature
Usuários logados comentam em avistamentos **aprovados**. Os comentários são publicados
na hora (pós-moderação): qualquer usuário pode denunciar, e um comentário com 3
denúncias some até um moderador decidir.

## Requisitos
| ID | Requisito |
|---|---|
| SEC-90 | Só usuário logado comenta; texto de 2 a 1000 caracteres, validado por schema e exibido como texto puro (sem HTML nem Markdown; links não viram clicáveis). |
| SEC-91 | Rate limit de 20 comentários/h por usuário. |
| SEC-92 | Só dá para comentar em avistamento aprovado (relato pendente/rejeitado → 404). |
| SEC-93 | O autor apaga o próprio comentário; o moderador remove qualquer um, com registro no `audit_log`. Remoção é lógica (o texto sai da API, a linha fica para auditoria). |
| SEC-94 | Denúncia: cada usuário denuncia um comentário uma vez só (sem inflar contagem); com 3 denúncias o comentário fica `oculto` até o moderador restaurar ou remover. Ninguém denuncia o próprio comentário. |
| SEC-95 | A listagem pública nunca devolve comentários `oculto`/`removido`, nem o e-mail dos autores. |

## Ameaças (STRIDE)
| Ameaça | Cenário | Mitigação |
|---|---|---|
| **T**ampering | XSS armazenado no comentário | SEC-90, SEC-06 (CSP), WAF |
| **D**enial of service | Flood de comentários | SEC-91, rate limit do WAF |
| **T**ampering | Um usuário derruba comentário alheio denunciando várias vezes | SEC-94 |
| **E**levation of privilege | Apagar comentário de outro usuário | SEC-93 |
| **I**nformation disclosure | Lista de comentários vaza e-mail | SEC-95 |
| **R**epudiation | Moderador nega ter removido comentário | SEC-93 (audit_log) |

## Critérios de aceite
- [ ] SEC-90: anônimo comentando → 401; comentário com 1001 caracteres → 400.
- [ ] SEC-90: `<script>` é guardado e devolvido como texto, sem ser interpretado.
- [ ] SEC-91: 21º comentário na mesma hora → 429.
- [ ] SEC-92: comentar em relato pendente → 404.
- [ ] SEC-93: usuário B apagando comentário de A → 404; moderador removendo → 204 + linha no `audit_log`.
- [ ] SEC-94: mesma pessoa denunciando 2 vezes conta 1; 3 pessoas diferentes → comentário oculto.
- [ ] SEC-95: resposta da listagem não contém campo de e-mail.
