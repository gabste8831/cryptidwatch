# 01 — Autenticação e sessão

## Feature
Cadastro, login e logout. Papéis: `usuario` (padrão) e `moderador`.
Sessão por JWT de curta duração em cookie `HttpOnly`.

## Requisitos
| ID | Requisito |
|---|---|
| SEC-10 | Senhas guardadas com bcrypt (custo ≥ 12). Nunca em texto puro nem em log. |
| SEC-11 | Senha com no mínimo 10 caracteres; e-mail validado e normalizado (minúsculas). |
| SEC-12 | JWT assinado com HS256, segredo ≥ 32 bytes vindo do Secrets Manager, expiração de 1h. `alg: none` e outros algoritmos são rejeitados. |
| SEC-13 | JWT em cookie `HttpOnly; Secure; SameSite=Strict`, inacessível ao JavaScript (mitiga roubo via XSS). |
| SEC-14 | Login com mensagem genérica ("credenciais inválidas"), igual para e-mail inexistente e senha errada. |
| SEC-15 | Cadastro sempre cria `usuario`; enviar o campo `role` é recusado (400, SEC-07). Moderador só é criado pelo script de seed. |
| SEC-16 | Rate limit de login: 5 tentativas/min por IP (SEC-02) e log de falhas no CloudWatch. |

## Ameaças (STRIDE)
| Ameaça | Cenário | Mitigação |
|---|---|---|
| **S**poofing | Força bruta / credential stuffing | SEC-02, SEC-16, rate limit do WAF |
| **S**poofing | Token forjado com `alg: none` | SEC-12 |
| **T**ampering | Usuário se cadastra com `role: moderador` | SEC-15 |
| **I**nformation disclosure | Enumeração de e-mails pelo login | SEC-14 |
| **I**nformation disclosure | Vazamento de banco expõe senhas | SEC-10 |
| **E**levation of privilege | Token roubado por XSS | SEC-13, SEC-06 (CSP) |

## Critérios de aceite
- [ ] SEC-10: o hash salvo começa com `$2` e não contém a senha.
- [ ] SEC-11: senha de 9 caracteres → 400.
- [ ] SEC-12: token com `alg: none` → 401; token expirado → 401; assinado com outro segredo → 401.
- [ ] SEC-13: resposta do login tem `Set-Cookie` com `HttpOnly`, `Secure` e `SameSite=Strict`.
- [ ] SEC-14: e-mail inexistente e senha errada retornam o mesmo status e corpo.
- [ ] SEC-15: cadastro com `{"role":"moderador"}` é recusado (400) e nenhum moderador é criado.
- [ ] SEC-16: 6ª tentativa de login no mesmo minuto → 429.
