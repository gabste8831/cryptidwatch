# Bucket privado das fotos (SEC-34, SEC-37). Nada público: só URLs pré-assinadas.

variable "name" { type = string }
variable "allowed_origins" {
  description = "Origens que podem fazer upload direto do navegador (CORS)."
  type        = list(string)
}

data "aws_caller_identity" "current" {}

# Criado via CloudFormation por causa da restrição do Learner Lab (ver modules/s3-bucket-cfn).
# Já nasce com SSE-S3, bloqueio de acesso público e ACLs desligadas.
# Riscos aceitos do bucket (replicação, versionamento, logs de acesso): docs/riscos-aceitos.md.
module "bucket" {
  source      = "../s3-bucket-cfn"
  name        = "${var.name}-fotos-${data.aws_caller_identity.current.account_id}"
  description = "Fotos dos avistamentos (privado, acesso so por URL pre-assinada)" # sem acento: o CloudFormation grava como "?"
}

# SEC-37: o que ficou na quarentena (upload não confirmado) some em 1 dia.
resource "aws_s3_bucket_lifecycle_configuration" "photos" {
  bucket = module.bucket.name
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
  bucket = module.bucket.name
  cors_rule {
    allowed_methods = ["POST", "GET"]
    allowed_origins = var.allowed_origins
    allowed_headers = ["*"]
    max_age_seconds = 300
  }
}

resource "aws_s3_bucket_policy" "photos" {
  bucket = module.bucket.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "SomenteHTTPS"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [module.bucket.arn, "${module.bucket.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}

output "bucket" { value = module.bucket.name }
output "arn" { value = module.bucket.arn }
output "regional_domain" { value = module.bucket.regional_domain }
