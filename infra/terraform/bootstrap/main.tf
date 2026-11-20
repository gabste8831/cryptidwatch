# Bootstrap: cria o bucket que guarda o estado do Terraform (SEC-60).
# Roda uma vez por conta, com estado local:
#   cd infra/terraform/bootstrap && terraform init && terraform apply
# O estado principal fica versionado (dá para voltar a uma versão anterior) e criptografado.

terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
}

provider "aws" {
  region = "us-east-1"
  default_tags {
    tags = { Project = "cryptidwatch", ManagedBy = "terraform", Stack = "bootstrap" }
  }
}

data "aws_caller_identity" "current" {}

# Bucket criado via CloudFormation por causa da restrição do Learner Lab
# (detalhes em ../modules/s3-bucket-cfn). Já nasce criptografado e sem acesso público.
module "tfstate" {
  source      = "../modules/s3-bucket-cfn"
  name        = "cryptidwatch-tfstate-${data.aws_caller_identity.current.account_id}"
  description = "Estado do Terraform do CryptidWatch"
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = module.tfstate.name
  versioning_configuration { status = "Enabled" }
}

# Versões antigas do estado ficam 90 dias (dá para voltar atrás) e depois são apagadas.
resource "aws_s3_bucket_lifecycle_configuration" "tfstate" {
  bucket = module.tfstate.name
  rule {
    id     = "versoes-antigas"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration { noncurrent_days = 90 }
    abort_incomplete_multipart_upload { days_after_initiation = 1 }
  }
  depends_on = [aws_s3_bucket_versioning.tfstate]
}

# Só HTTPS: o estado tem dados sensíveis (endpoints, ARNs).
resource "aws_s3_bucket_policy" "tfstate" {
  bucket = module.tfstate.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "SomenteHTTPS"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [module.tfstate.arn, "${module.tfstate.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}

output "state_bucket" {
  description = "Use em: terraform init -backend-config=\"bucket=<este valor>\""
  value       = module.tfstate.name
}
