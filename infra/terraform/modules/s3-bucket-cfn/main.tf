# Cria um bucket S3 "nu" por uma stack do CloudFormation gerenciada pelo Terraform.
#
# Por quê: no AWS Academy Learner Lab, uma SCP da organização nega
# s3:GetBucketObjectLockConfiguration. O recurso aws_s3_bucket do provider lê essa
# configuração logo após criar o bucket e trata o "acesso negado" como erro fatal
# (em todas as versões). A stack do CloudFormation cria o bucket sem fazer essa leitura.
#
# Todo o resto da configuração (criptografia, bloqueio de acesso público, CORS, ciclo
# de vida, política) continua nos recursos aws_s3_bucket_* normais, que não são afetados.
# Fora do Learner Lab, este módulo pode ser trocado por um aws_s3_bucket simples.
#
# Atenção: o CloudFormation só apaga bucket vazio. O scripts/destroy.sh esvazia os
# buckets antes do terraform destroy.

variable "name" {
  description = "Nome global do bucket."
  type        = string
}

variable "description" {
  type    = string
  default = "Bucket do CryptidWatch"
}

resource "aws_cloudformation_stack" "this" {
  #checkov:skip=CKV_AWS_124:Stack de um recurso só, gerenciada pelo Terraform; eventos ficam no CloudTrail do laboratório
  name = "bucket-${var.name}"

  template_body = jsonencode({
    AWSTemplateFormatVersion = "2010-09-09"
    Description              = var.description
    Resources = {
      Bucket = {
        Type           = "AWS::S3::Bucket"
        DeletionPolicy = "Delete"
        Properties = {
          BucketName = var.name
          # Já nasce criptografado e fechado; os recursos aws_s3_bucket_* reforçam isso.
          BucketEncryption = {
            ServerSideEncryptionConfiguration = [{
              ServerSideEncryptionByDefault = { SSEAlgorithm = "AES256" }
            }]
          }
          PublicAccessBlockConfiguration = {
            BlockPublicAcls       = true
            BlockPublicPolicy     = true
            IgnorePublicAcls      = true
            RestrictPublicBuckets = true
          }
          OwnershipControls = { Rules = [{ ObjectOwnership = "BucketOwnerEnforced" }] }
        }
      }
    }
    Outputs = {
      Arn                = { Value = { "Fn::GetAtt" = ["Bucket", "Arn"] } }
      RegionalDomainName = { Value = { "Fn::GetAtt" = ["Bucket", "RegionalDomainName"] } }
    }
  })
}

output "name" {
  value = var.name
  # Só "existe" depois que a stack terminou de criar o bucket.
  depends_on = [aws_cloudformation_stack.this]
}

output "arn" { value = aws_cloudformation_stack.this.outputs["Arn"] }
output "regional_domain" { value = aws_cloudformation_stack.this.outputs["RegionalDomainName"] }
