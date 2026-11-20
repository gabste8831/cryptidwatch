#!/usr/bin/env bash
# Faz o build das imagens e envia ao ECR com a tag do commit (tags são imutáveis, SEC-71).
#   scripts/push-images.sh [tag]
set -euo pipefail

cd "$(dirname "$0")/.."
TAG="${1:-$(git rev-parse --short=12 HEAD)}"
REGION="${AWS_REGION:-us-east-1}"

declare -A REPOS
REPOS[api]=$(terraform -chdir=infra/terraform output -json ecr_repositories | jq -r '.api')
REPOS[web]=$(terraform -chdir=infra/terraform output -json ecr_repositories | jq -r '.web')
REGISTRY="${REPOS[api]%%/*}"

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"

for app in api web; do
  repo="${REPOS[$app]}"
  if aws ecr describe-images --region "$REGION" --repository-name "${repo#*/}" --image-ids imageTag="$TAG" >/dev/null 2>&1; then
    echo "→ $repo:$TAG já existe, pulando"
    continue
  fi
  echo "→ build $app"
  docker build -t "$repo:$TAG" "app/$app"
  docker push "$repo:$TAG"
done

echo "Imagens prontas com a tag $TAG"
