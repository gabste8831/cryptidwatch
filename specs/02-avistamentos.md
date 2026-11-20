# 02 — Avistamentos (relatar, buscar, filtrar)

## Feature
Usuário logado relata um avistamento: criptídeo (da lista), título, descrição,
local (cidade/UF e coordenadas opcionais) e data. Qualquer visitante busca e filtra
os relatos **aprovados** por criptídeo, UF, período e texto.

## Requisitos
| ID | Requisito |
|---|---|
| SEC-01 | Busca e filtros usam queries parametrizadas; ordenação só por colunas de uma lista permitida. |
| SEC-02 | Criação limitada a 10 relatos/h por usuário. |
| SEC-20 | Validação por schema: título ≤ 120, descrição ≤ 4000, UF em lista fechada, data não futura, coordenadas dentro de faixa válida. |
| SEC-21 | Texto exibido sempre escapado (React, sem `dangerouslySetInnerHTML`); CSP bloqueia script inline. |
| SEC-22 | Relato novo nasce `pendente`; listagem pública só mostra `aprovado`. |
| SEC-23 | Só o autor edita/apaga o próprio relato enquanto `pendente` (checagem de dono no servidor, mitiga IDOR). |
| SEC-24 | Paginação obrigatória (máx. 50 por página) para evitar consultas pesadas. |

## Ameaças (STRIDE)
| Ameaça | Cenário | Mitigação |
|---|---|---|
| **T**ampering | SQL injection na busca (`' OR 1=1--`) | SEC-01, WAF SQLi |
| **T**ampering | XSS armazenado na descrição | SEC-21, SEC-06, WAF XSS |
| **E**levation of privilege | Editar relato de outro usuário trocando o ID | SEC-23 |
| **D**enial of service | Spam de relatos / listagem sem limite | SEC-02, SEC-24 |
| **I**nformation disclosure | Relato não moderado aparece em público | SEC-22 |

## Critérios de aceite
- [ ] SEC-01: busca por `' OR 1=1--` retorna lista vazia, sem erro 500.
- [ ] SEC-01: `sort=senha_hash` → 400.
- [ ] SEC-20: título com 121 caracteres → 400; data futura → 400.
- [ ] SEC-22: relato recém-criado não aparece em `GET /api/sightings`.
- [ ] SEC-23: usuário B editando relato de A → 404.
- [ ] SEC-24: `limit=500` → no máximo 50 itens.
