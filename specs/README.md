# Especificações de segurança (SDD)

Cada feature tem uma spec com:
- **Requisitos SEC-xx**: numerados e únicos no projeto inteiro.
- **Ameaças (STRIDE)**: o que pode dar errado e qual SEC mitiga.
- **Critérios de aceite**: viram testes automatizados. O nome do teste cita o SEC
  (`it('SEC-03: usuário comum recebe 403 ao aprovar relato')`), então dá para
  rastrear requisito → teste → resultado da pipeline.

| Spec | Requisitos |
|---|---|
| [01-autenticacao.md](01-autenticacao.md) | SEC-10 a SEC-16 |
| [02-avistamentos.md](02-avistamentos.md) | SEC-01, SEC-02, SEC-20 a SEC-24 |
| [03-upload-fotos.md](03-upload-fotos.md) | SEC-04, SEC-30 a SEC-37 |
| [04-moderacao.md](04-moderacao.md) | SEC-03, SEC-40 a SEC-42 |
| [05-ranking.md](05-ranking.md) | SEC-50 a SEC-52 |
| [06-infraestrutura.md](06-infraestrutura.md) | SEC-60 a SEC-72 |
| [07-pipeline.md](07-pipeline.md) | SEC-80 a SEC-85 |

## Requisitos transversais

| ID | Requisito |
|---|---|
| SEC-01 | Toda query SQL usa parâmetros (`$1`, `$2`); concatenar entrada do usuário em SQL é proibido. |
| SEC-02 | Rate limit em login (5/min por IP) e criação de relatos (10/h por usuário), além do rate limit do WAF. |
| SEC-03 | RBAC: só `moderador` aprova/rejeita relatos e fotos. Checado no servidor, nunca só na interface. |
| SEC-04 | Upload validado por magic bytes e reprocessado no servidor; SVG proibido. |
| SEC-05 | Erros não vazam stack trace nem detalhes do banco; resposta genérica + log com ID de correlação. |
| SEC-06 | Cabeçalhos de segurança (helmet): CSP, HSTS, X-Content-Type-Options, frame-ancestors 'none'. |
| SEC-07 | Toda entrada é validada por schema (zod) com tamanhos máximos; campos desconhecidos são rejeitados. |
