# Segredos da aplicação no Secrets Manager (SEC-68). Gerados aqui, nunca escritos em
# código, imagem ou manifest. A API lê o JSON pelo APP_SECRET_ID usando a LabRole dos nós.

variable "name" { type = string }

resource "random_password" "db" {
  length           = 32
  special          = true
  override_special = "!#%^*-_=+" # o RDS não aceita / @ " e espaço
}

resource "random_password" "redis" {
  length           = 48
  special          = true
  override_special = "!&#$^<>-" # caracteres aceitos no AUTH token do ElastiCache
}

resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  #checkov:skip=CKV_AWS_149:Criptografado com a chave gerenciada pela AWS; CMK própria fora do escopo do laboratório
  #checkov:skip=CKV2_AWS_57:Rotação automática exige Lambda com role própria; o ambiente é recriado a cada sessão do laboratório
  name                    = "${var.name}/app"
  description             = "Segredos da API do CryptidWatch (banco, Redis e JWT)"
  recovery_window_in_days = 0 # laboratório: permite recriar com o mesmo nome logo após o destroy
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    DB_PASSWORD      = random_password.db.result
    REDIS_AUTH_TOKEN = random_password.redis.result
    JWT_SECRET       = random_password.jwt.result
  })
}

output "secret_arn" { value = aws_secretsmanager_secret.app.arn }
output "secret_name" { value = aws_secretsmanager_secret.app.name }

output "db_password" {
  value     = random_password.db.result
  sensitive = true
}

output "redis_auth_token" {
  value     = random_password.redis.result
  sensitive = true
}
