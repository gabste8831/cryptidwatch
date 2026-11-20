# Repositórios das imagens (SEC-71): scan na hora do push e tags imutáveis
# (uma tag publicada nunca é sobrescrita por outra imagem).

variable "name" { type = string }
variable "repositories" {
  type    = list(string)
  default = ["api", "web"]
}

resource "aws_ecr_repository" "this" {
  #checkov:skip=CKV_AWS_136:Criptografado com AES256 gerenciado pela AWS; CMK própria fora do escopo do laboratório
  for_each             = toset(var.repositories)
  name                 = "${var.name}/${each.key}"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = true # laboratório: destroy limpa as imagens

  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "AES256" }
}

resource "aws_ecr_lifecycle_policy" "this" {
  for_each   = aws_ecr_repository.this
  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Guarda só as 15 imagens mais recentes"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 15 }
      action       = { type = "expire" }
    }]
  })
}

output "repository_urls" {
  value = { for k, r in aws_ecr_repository.this : k => r.repository_url }
}
