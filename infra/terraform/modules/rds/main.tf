# PostgreSQL na camada de dados (SEC-66): sem IP público, criptografado em repouso,
# TLS obrigatório, backups de 7 dias, logs exportados para o CloudWatch.

variable "name" { type = string }
variable "subnet_ids" { type = list(string) }
variable "security_group_id" { type = string }
variable "password" {
  type      = string
  sensitive = true
}
variable "instance_class" {
  type    = string
  default = "db.t3.micro"
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name}-db"
  subnet_ids = var.subnet_ids
}

resource "aws_db_parameter_group" "this" {
  name   = "${var.name}-pg16"
  family = "postgres16"

  parameter {
    name         = "rds.force_ssl" # recusa qualquer conexão sem TLS
    value        = "1"
    apply_method = "pending-reboot" # parâmetro estático: vale desde a criação da instância
  }
  parameter {
    name  = "log_connections"
    value = "1"
  }
  parameter {
    name  = "log_disconnections"
    value = "1"
  }
}

resource "aws_db_instance" "this" {
  #checkov:skip=CKV_AWS_157:Multi-AZ desligado por custo no laboratório (em produção: true)
  #checkov:skip=CKV_AWS_293:Deletion protection desligado para o terraform destroy do laboratório
  #checkov:skip=CKV_AWS_353:Performance Insights não suportado no db.t3.micro
  #checkov:skip=CKV_AWS_118:Enhanced monitoring exige role própria (não dá para criar roles no Learner Lab)
  #checkov:skip=CKV_AWS_161:A API autentica por senha guardada no Secrets Manager; IAM auth exigiria IRSA
  identifier     = "${var.name}-db"
  engine         = "postgres"
  engine_version = "16"
  instance_class = var.instance_class

  db_name  = "cryptidwatch"
  username = "cryptidwatch"
  password = var.password

  allocated_storage     = 20
  max_allocated_storage = 50
  storage_type          = "gp3"
  storage_encrypted     = true

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [var.security_group_id]
  parameter_group_name   = aws_db_parameter_group.this.name
  publicly_accessible    = false
  multi_az               = false # laboratório; em produção, true

  backup_retention_period         = 7
  copy_tags_to_snapshot           = true
  auto_minor_version_upgrade      = true
  enabled_cloudwatch_logs_exports = ["postgresql"]

  # Laboratório: o destroy precisa conseguir apagar sem snapshot final.
  deletion_protection = false
  skip_final_snapshot = true
  apply_immediately   = true
}

output "address" { value = aws_db_instance.this.address }
output "port" { value = aws_db_instance.this.port }
output "identifier" { value = aws_db_instance.this.identifier }
