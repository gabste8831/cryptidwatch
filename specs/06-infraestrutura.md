# 06 — Infraestrutura e rede

## Requisitos
| ID | Requisito |
|---|---|
| SEC-60 | Toda a infra em Terraform; nenhuma mudança manual no console. Estado em S3 versionado e criptografado. `terraform apply` recria tudo (plano de DR). |
| SEC-61 | VPC com 3 camadas em 2 AZs: públicas (ALB, NAT), privadas de app (EKS), privadas de dados (RDS, Redis) **sem rota para a internet**. |
| SEC-62 | SGs em cadeia: SG-ALB aceita 80/443 da internet → SG-Nós aceita só do SG-ALB (NodePort) → SG-Dados aceita 5432/6379 só do SG-Nós. |
| SEC-63 | Nós do EKS sem IP público e sem SSH. |
| SEC-64 | WAF no ALB: AWSManagedRulesSQLiRuleSet, CommonRuleSet (XSS), KnownBadInputsRuleSet e rate limit de 300 req/5 min por IP. |
| SEC-65 | ALB: HTTP 80 redireciona para HTTPS 443; política TLS 1.2+; certificado no ACM. |
| SEC-66 | RDS: criptografia em repouso (KMS), `rds.force_ssl=1`, sem acesso público, backups automáticos de 7 dias. |
| SEC-67 | ElastiCache: criptografia em repouso e em trânsito, AUTH token. |
| SEC-68 | Segredos (senha do banco, token do Redis, segredo JWT) no Secrets Manager; nunca no código, imagem ou manifest. |
| SEC-69 | NetworkPolicy no namespace `cryptidwatch`: default-deny; `web` recebe só tráfego externo; `api` recebe só do externo (ALB) na sua porta. |
| SEC-70 | Logs do WAF e da aplicação no CloudWatch, com alarme para pico de requisições bloqueadas. |
| SEC-71 | ECR com scan on push e tags imutáveis. |
| SEC-72 | Containers rodam como usuário não-root, filesystem read-only, sem privilégios extras, com limites de CPU/memória. |

## Ameaças (STRIDE)
| Ameaça | Cenário | Mitigação |
|---|---|---|
| **I**nformation disclosure | Banco exposto à internet | SEC-61, SEC-62, SEC-66 |
| **T**ampering | SQLi/XSS chegando na aplicação | SEC-64 |
| **D**enial of service | Flood de requisições | SEC-64 (rate limit) |
| **E**levation of privilege | Pod comprometido acessa outros pods | SEC-69, SEC-72 |
| **I**nformation disclosure | Senha do banco commitada no Git | SEC-68, SEC-82 |
| **R**epudiation | Ataque sem rastro | SEC-70 |

## Critérios de aceite
- [ ] SEC-64: `curl "https://<alb>/api/sightings?q=' OR 1=1--"` → 403 do WAF.
- [ ] SEC-64: `curl "https://<alb>/?q=<script>alert(1)</script>"` → 403 do WAF.
- [ ] SEC-61: RDS e Redis com `publicly_accessible = false` e route table de dados sem 0.0.0.0/0.
- [ ] SEC-62: `checkov`/`tfsec` sem falhas críticas de SG.
- [ ] SEC-65: `curl -I http://<alb>` → 301 para https.
