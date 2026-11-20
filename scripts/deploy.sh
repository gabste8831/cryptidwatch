#!/usr/bin/env bash
# Publica a aplicação no EKS usando as saídas do Terraform.
#   scripts/deploy.sh [tag]
# Precisa de: terraform (com o estado inicializado), aws, kubectl, jq.
set -euo pipefail

cd "$(dirname "$0")/.."
TAG="${1:-$(git rev-parse --short=12 HEAD)}"
REGION="${AWS_REGION:-us-east-1}"
TF="terraform -chdir=infra/terraform"

CLUSTER=$($TF output -raw cluster_name)
API_REPO=$($TF output -json ecr_repositories | jq -r '.api')
WEB_REPO=$($TF output -json ecr_repositories | jq -r '.web')
SITE=$($TF output -raw site_url)

echo "→ kubeconfig do cluster $CLUSTER"
aws eks update-kubeconfig --region "$REGION" --name "$CLUSTER" >/dev/null

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# ConfigMap com endereços e nomes vindos do Terraform (nenhum segredo: SEC-68).
$TF output -json app_config | jq -r 'to_entries[] | "\(.key)=\(.value)"' > "$WORK/app.env"

kubectl apply -f k8s/namespace.yaml
kubectl -n cryptidwatch create configmap api-config --from-env-file="$WORK/app.env" \
  --dry-run=client -o yaml | kubectl apply -f -

# Troca as imagens de exemplo pelas do ECR com a tag do commit.
cp k8s/*.yaml "$WORK/"
sed -i \
  -e "s#newName: cryptidwatch/api#newName: $API_REPO#" \
  -e "s#newName: cryptidwatch/web#newName: $WEB_REPO#" \
  -e "s#newTag: local#newTag: \"$TAG\"#" \
  "$WORK/kustomization.yaml"

kubectl apply -k "$WORK"

# O ConfigMap pode ter mudado sem a imagem mudar: força os pods a relerem.
kubectl -n cryptidwatch rollout restart deployment/api deployment/web >/dev/null
kubectl -n cryptidwatch rollout status deployment/api --timeout=5m
kubectl -n cryptidwatch rollout status deployment/web --timeout=5m

echo
echo "CryptidWatch no ar: $SITE"
echo "(certificado autoassinado: o navegador vai pedir confirmação)"
