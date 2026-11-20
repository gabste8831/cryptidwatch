# Kubernetes (EKS)

| Arquivo | O que tem |
|---|---|
| `namespace.yaml` | Namespace `cryptidwatch` com Pod Security **restricted** (o cluster recusa pod root/privilegiado) |
| `api.yaml` | ServiceAccount sem token, Deployment (2 réplicas), Service NodePort **30300**, PDB |
| `web.yaml` | Idem para o Nginx, NodePort **30080** |
| `networkpolicy.yaml` | **default-deny** + exceções (SEC-69) |
| `kustomization.yaml` | Junta tudo; o deploy troca `API_IMAGE`/`WEB_IMAGE` pelas imagens do ECR |

O ConfigMap `api-config` não fica no repositório: o `scripts/deploy.sh` gera a partir do
`terraform output app_config`. **Nenhum segredo vai para o Kubernetes**: a API lê senha do
banco, token do Redis e segredo JWT direto do Secrets Manager.

## Segurança dos pods (SEC-72)

- UID alto (10001 / 10101), `runAsNonRoot`, seccomp `RuntimeDefault`
- Filesystem raiz **só leitura**; só `/tmp` (e o `conf.d` do Nginx) graváveis via `emptyDir`
- Todas as capabilities removidas, `allowPrivilegeEscalation: false`
- Limites de CPU e memória, probes de saúde, PDB e espalhamento entre AZs
- `automountServiceAccountToken: false`: os pods não têm credencial da API do Kubernetes

## Rede (NetworkPolicy)

```
internet → WAF → ALB → NodePort ─┬─▶ web:8080   (saída: só DNS)
                                 └─▶ api:3000   (saída: DNS, RDS 5432 e Redis 6379 nas
                                                 subnets de dados, IMDS, HTTPS fora da VPC)
```

O `web` não alcança a `api` nem os bancos; a `api` não abre conexão com outros pods.

## Deploy

```bash
scripts/push-images.sh
```

```bash
scripts/deploy.sh
```

```bash
scripts/seed-moderator.sh seu-email@exemplo.com
```

## Validação local (sem cluster)

```bash
docker run --rm -v "$(pwd)/k8s:/k8s" ghcr.io/yannh/kubeconform -strict -summary -ignore-filename-pattern kustomization /k8s
```

```bash
docker run --rm -v "$(pwd)/k8s:/k8s" bridgecrew/checkov -d /k8s --framework kubernetes --compact
```

Resultado atual: kubeconform 12/12 válidos; checkov 180 aprovadas, 0 falhas, 4 exceções
(tag/digest da imagem: o deploy usa a tag do commit num ECR com tags imutáveis).
