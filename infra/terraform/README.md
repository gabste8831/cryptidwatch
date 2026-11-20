# Infraestrutura (Terraform)

Toda a AWS do CryptidWatch em código. Um `terraform apply` recria o ambiente inteiro do zero:
é o **plano de recuperação de desastre** (SEC-60).

```
bootstrap/            bucket S3 do estado (roda uma vez, estado local)
main.tf               liga os módulos
modules/
  vpc/                VPC 10.0.0.0/16, 3 camadas × 2 AZs, NAT, VPC Endpoint S3, flow logs
  security-groups/    SG-ALB → SG-Nós → SG-Dados (cadeia)
  secrets/            senhas aleatórias no Secrets Manager
  ecr/                repositórios api e web (scan on push, tags imutáveis)
  rds/                PostgreSQL 16 (TLS obrigatório, criptografado, sem IP público)
  redis/              ElastiCache Redis 7 (TLS + AUTH, criptografado)
  eks/                cluster + node group (LabRole, IMDSv2, NetworkPolicy no VPC CNI)
  alb-waf-acm/        ALB HTTPS + WAF (SQLi, XSS, bad inputs, reputação de IP, rate limit) + certificado
  s3-fotos/           bucket privado das fotos (CORS só do site, quarentena expira em 1 dia)
  observability/      log group da aplicação e alarmes
```

## Pré-requisitos

- **Terraform ≥ 1.10** e **AWS CLI**. No Windows:
  ```bash
  winget install Hashicorp.Terraform
  ```
  ```bash
  winget install Amazon.AWSCLI
  ```
  Sem instalar nada, dá para usar o Terraform pelo Docker (veja o fim deste arquivo).
- **Credenciais do Learner Lab:** inicie o lab, clique em *AWS Details → AWS CLI: Show* e
  cole o conteúdo em `~/.aws/credentials`. Elas expiram em ~4 h.

## Subir o ambiente

```bash
cd infra/terraform/bootstrap
terraform init
terraform apply
```

Anote o `state_bucket` da saída. Depois, na pasta `infra/terraform`:

```bash
terraform init -backend-config="bucket=cryptidwatch-tfstate-<ID-DA-CONTA>"
```

```bash
terraform plan -out=tfplan
```

```bash
terraform apply tfplan
```

O EKS leva uns 15–20 minutos. No fim, `terraform output` mostra o endereço do site, os
repositórios do ECR e o `app_config` que vai para o ConfigMap da API.

## Derrubar tudo (sempre depois de testar)

```bash
terraform destroy
```

O bucket de estado do bootstrap fica (é barato e guarda o histórico). Para remover também:
esvazie o bucket e rode `terraform destroy` em `bootstrap/`.

## Scan de segurança

```bash
docker run --rm -v "$(pwd):/tf" bridgecrew/checkov -d /tf --framework terraform --compact
```

Resultado atual: 168 aprovadas, 0 falhas, 45 exceções justificadas. Veja
[docs/riscos-aceitos.md](../../docs/riscos-aceitos.md).

## Terraform pelo Docker (sem instalar)

No PowerShell, dentro de `infra/terraform`:

```bash
docker run --rm -it -v "${PWD}:/src" -v "$HOME/.aws:/root/.aws:ro" -w /src hashicorp/terraform:latest plan
```

## Particularidades do Learner Lab

- **Sem criar roles:** cluster, nós e flow logs usam a `LabRole` existente.
- **Sem IRSA:** não há AWS Load Balancer Controller. O Terraform cria o ALB e os target
  groups apontam para os nós nos NodePorts fixos `30080` (web) e `30300` (api).
- **Credenciais dos pods:** os pods usam a LabRole pelo IMDSv2 do nó (hop limit 2) para ler
  o Secrets Manager e o S3.
- **Sem domínio:** o certificado é autoassinado (gerado pelo provider `tls`) e importado no
  ACM. O navegador avisa, mas o tráfego é TLS 1.2/1.3.
- **Custo:** EKS (~US$ 0,10/h), NAT Gateway, RDS, ElastiCache e 2 nós t3.medium. Rode o
  `destroy` ao terminar.
