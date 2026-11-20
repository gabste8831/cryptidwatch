# Pipeline CI/CD (GitHub Actions)

Arquivo: [.github/workflows/ci.yml](../.github/workflows/ci.yml). Requisitos em
[specs/07-pipeline.md](../specs/07-pipeline.md).

| Job | O que faz | Requisito |
|---|---|---|
| Segredos (gitleaks) | Varre o histórico inteiro atrás de chaves e senhas | SEC-82 |
| API | `npm audit`, ESLint com regras de segurança, 69 testes ligados aos SEC-xx com cobertura | SEC-83, specs 01–05, 08 |
| Web | `npm audit`, ESLint (proíbe `dangerouslySetInnerHTML`), build | SEC-83, SEC-101 |
| SAST (SonarCloud) | Análise estática de JS, Terraform, Kubernetes e Dockerfiles. **Quality gate reprovado = job vermelho = merge bloqueado** | SEC-81 |
| IaC | `terraform fmt/validate`, checkov (Terraform + Kubernetes), kubeconform, shellcheck | SEC-85 |
| Imagens | `docker build` + Trivy: vulnerabilidade HIGH/CRITICAL com correção disponível falha | SEC-83 |
| Terraform plan | Em PR, mostra o que mudaria na AWS | SEC-85 |
| Deploy | Na `main`: `terraform apply` → push no ECR → `kubectl apply` no EKS | SEC-85 |

Endurecimento da própria pipeline:
- `permissions: contents: read`: o token do GitHub só lê o repositório.
- Actions de terceiros fixadas pelo **SHA do commit**, nunca pela tag (uma tag pode ser
  movida para código malicioso; isso aconteceu com o `trivy-action` em 2026). O Dependabot
  atualiza os SHAs.
- Credenciais da AWS só no environment `aws-academy`; os jobs de PR que não usam AWS nunca
  as recebem.
- `main` protegida: só por PR, com os checks obrigatórios.

## Configurar o SonarCloud (uma vez)

1. Entre em https://sonarcloud.io com **Log in with GitHub**.
2. Crie a organização a partir da sua **conta pessoal** `gabste8831` (plano gratuito).
3. **Analyze new project** → escolha `cryptidwatch`.
4. Em **Administration → Analysis Method**, desligue a **Automatic Analysis** (a análise é
   feita pela pipeline, que envia a cobertura dos testes).
5. Em **My Account → Security**, gere um token.
6. No GitHub: **Settings → Secrets and variables → Actions → New repository secret**:
   `SONAR_TOKEN` = o token.

Sem o token, o job do SonarCloud só emite um aviso, para a pipeline não travar antes da
configuração.

## Ligar a AWS (a cada sessão do AWS Academy)

As credenciais do Learner Lab expiram em ~4 h. Em **Settings → Environments → aws-academy**:

| Tipo | Nome | Valor |
|---|---|---|
| Secret | `AWS_ACCESS_KEY_ID` | do *AWS Details → AWS CLI* do lab |
| Secret | `AWS_SECRET_ACCESS_KEY` | idem |
| Secret | `AWS_SESSION_TOKEN` | idem |
| Variable (repositório) | `TF_STATE_BUCKET` | `cryptidwatch-tfstate-<ID-da-conta>` (saída do bootstrap) |
| Variable (repositório) | `AWS_DEPLOY_ENABLED` | `true` enquanto o lab estiver ligado; `false` depois |

Para derrubar tudo: **Actions → Destruir infraestrutura → Run workflow** e digite `destruir`.
