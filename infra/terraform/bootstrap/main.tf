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

resource "aws_s3_bucket" "tfstate" {
  #checkov:skip=CKV_AWS_144:Replicação entre regiões fora do escopo do laboratório
  #checkov:skip=CKV2_AWS_62:Sem consumidores de eventos para o estado
  #checkov:skip=CKV_AWS_145:SSE-S3 (AES256); CMK própria fora do escopo do laboratório
  #checkov:skip=CKV_AWS_18:Server access logs fora do escopo; o bucket só é acessado pelo Terraform
  bucket        = "cryptidwatch-tfstate-${data.aws_caller_identity.current.account_id}"
  force_destroy = false
}

# Versões antigas do estado ficam 90 dias (dá para voltar atrás) e depois são apagadas.
resource "aws_s3_bucket_lifecycle_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    id     = "versoes-antigas"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration { noncurrent_days = 90 }
    abort_incomplete_multipart_upload { days_after_initiation = 1 }
  }
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule { object_ownership = "BucketOwnerEnforced" }
}

# Só HTTPS: o estado tem dados sensíveis (endpoints, ARNs).
resource "aws_s3_bucket_policy" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "SomenteHTTPS"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.tfstate.arn, "${aws_s3_bucket.tfstate.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}

output "state_bucket" {
  description = "Use em: terraform init -backend-config=\"bucket=<este valor>\""
  value       = aws_s3_bucket.tfstate.bucket
}
