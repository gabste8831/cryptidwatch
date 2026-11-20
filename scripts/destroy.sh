#!/usr/bin/env bash
# Derruba toda a infraestrutura da AWS.
#   scripts/destroy.sh
# Os buckets são criados via CloudFormation (restrição do Learner Lab, ver
# infra/terraform/modules/s3-bucket-cfn), e o CloudFormation só apaga bucket vazio.
# Por isso o script esvazia fotos e logs antes do destroy. O ALB pode entregar um log
# atrasado enquanto é apagado, então tenta de novo se a exclusão do bucket falhar.
set -euo pipefail

cd "$(dirname "$0")/.."
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
BUCKETS=("cryptidwatch-fotos-$ACCOUNT" "cryptidwatch-alb-logs-$ACCOUNT")

esvaziar() {
  for b in "${BUCKETS[@]}"; do
    if aws s3api head-bucket --bucket "$b" >/dev/null 2>&1; then
      echo "→ esvaziando s3://$b"
      aws s3 rm "s3://$b" --recursive --only-show-errors
    fi
  done
}

for tentativa in 1 2 3; do
  esvaziar
  if terraform -chdir=infra/terraform destroy -input=false -auto-approve; then
    echo "Infraestrutura destruída."
    exit 0
  fi
  echo "Destroy falhou (tentativa $tentativa). Esperando logs atrasados do ALB e tentando de novo…"
  sleep 60
done

echo "Não foi possível destruir tudo. Confira no console da AWS." >&2
exit 1
