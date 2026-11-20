# Bucket privado das fotos (SEC-34, SEC-37). Nada público: só URLs pré-assinadas.

variable "name" { type = string }
variable "allowed_origins" {
  description = "Origens que podem fazer upload direto do navegador (CORS)."
  type        = list(string)
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "photos" {
  #checkov:skip=CKV_AWS_144:Replicação entre regiões fora do escopo do laboratório
  #checkov:skip=CKV2_AWS_62:O processamento das fotos é síncrono na API (/confirm), sem eventos
  #checkov:skip=CKV_AWS_21:Objetos nunca são sobrescritos (chave = UUID); versionamento só aumentaria custo
  #checkov:skip=CKV_AWS_145:SSE-S3 (AES256); CMK própria fora do escopo do laboratório
  #checkov:skip=CKV_AWS_18:Acesso auditado pela API (SHA-256 + audit_log); server access logs fora do escopo
  bucket        = "${var.name}-fotos-${data.aws_caller_identity.current.account_id}"
  force_destroy = true # ambiente de laboratório: o destroy apaga as fotos junto
}

resource "aws_s3_bucket_public_access_block" "photos" {
  bucket                  = aws_s3_bucket.photos.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "photos" {
  bucket = aws_s3_bucket.photos.id
  rule { object_ownership = "BucketOwnerEnforced" } # desliga ACLs
}

resource "aws_s3_bucket_server_side_encryption_configuration" "photos" {
  bucket = aws_s3_bucket.photos.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

# SEC-37: o que ficou na quarentena (upload não confirmado) some em 1 dia.
resource "aws_s3_bucket_lifecycle_configuration" "photos" {
  bucket = aws_s3_bucket.photos.id
  rule {
    id     = "limpa-quarentena"
    status = "Enabled"
    filter { prefix = "quarentena/" }
    expiration { days = 1 }
  }
  rule {
    id     = "aborta-multipart"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload { days_after_initiation = 1 }
  }
}

# Upload direto do navegador: só POST/GET, só da origem do site.
resource "aws_s3_bucket_cors_configuration" "photos" {
  bucket = aws_s3_bucket.photos.id
  cors_rule {
    allowed_methods = ["POST", "GET"]
    allowed_origins = var.allowed_origins
    allowed_headers = ["*"]
    max_age_seconds = 300
  }
}

resource "aws_s3_bucket_policy" "photos" {
  bucket = aws_s3_bucket.photos.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "SomenteHTTPS"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.photos.arn, "${aws_s3_bucket.photos.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
  depends_on = [aws_s3_bucket_public_access_block.photos]
}

output "bucket" { value = aws_s3_bucket.photos.bucket }
output "arn" { value = aws_s3_bucket.photos.arn }
output "regional_domain" { value = aws_s3_bucket.photos.bucket_regional_domain_name }
