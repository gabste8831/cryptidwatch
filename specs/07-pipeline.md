# 07 — Pipeline CI/CD

## Etapas
lint + testes → SAST (SonarCloud) → SCA (npm audit + Trivy) → build Docker →
push ECR → terraform plan (PR) / apply (main) → deploy no EKS.

## Requisitos
| ID | Requisito |
|---|---|
| SEC-80 | Branch `main` protegida: só merge por PR com pipeline verde. |
| SEC-81 | Quality gate do SonarCloud falhando barra o merge (sem vulnerabilidades novas, hotspots revisados). |
| SEC-82 | Secret scanning (gitleaks) em todo push. |
| SEC-83 | `npm audit --audit-level=high` e Trivy na imagem com severidade HIGH/CRITICAL falham a pipeline. |
| SEC-84 | Credenciais AWS e `SONAR_TOKEN` só em GitHub Secrets; nunca impressos em log. |
| SEC-85 | `terraform apply` só roda na `main`; em PR roda só `plan` + scan de IaC (tfsec/checkov). |

## Ameaças (STRIDE)
| Ameaça | Cenário | Mitigação |
|---|---|---|
| **T**ampering | Código vulnerável chega em produção | SEC-80, SEC-81 |
| **T**ampering | Dependência com CVE conhecida | SEC-83 |
| **I**nformation disclosure | Chave AWS commitada | SEC-82, SEC-84 |
| **E**levation of privilege | PR de fork aplica infra | SEC-85 |

## Critérios de aceite
- [ ] SEC-81: PR com `eval(req.query.x)` é barrado pelo SonarCloud.
- [ ] SEC-82: commit com chave AWS falsa é barrado pelo gitleaks.
- [ ] SEC-83: dependência com CVE HIGH falha o job.
