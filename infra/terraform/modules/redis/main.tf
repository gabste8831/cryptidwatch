# ElastiCache Redis na camada de dados (SEC-51, SEC-67): TLS em trânsito, criptografia em
# repouso e AUTH token. Guarda o ranking e os contadores de rate limit.

variable "name" { type = string }
variable "subnet_ids" { type = list(string) }
variable "security_group_id" { type = string }
variable "auth_token" {
  type      = string
  sensitive = true
}
variable "node_type" {
  type    = string
  default = "cache.t3.micro"
}

resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.name}-redis"
  subnet_ids = var.subnet_ids
}

resource "aws_elasticache_replication_group" "this" {
  #checkov:skip=CKV_AWS_191:Criptografia em repouso com chave gerenciada pela AWS; CMK própria fora do escopo do laboratório
  #checkov:skip=CKV2_AWS_50:Um nó só por custo; o Redis é cache e o PostgreSQL é a fonte da verdade (SEC-52)
  replication_group_id = "${var.name}-redis"
  description          = "Ranking e rate limit do CryptidWatch"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.node_type
  num_cache_clusters   = 1 # laboratório; em produção, 2+ com failover automático
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = [var.security_group_id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.auth_token

  apply_immediately = true
}

output "endpoint" { value = aws_elasticache_replication_group.this.primary_endpoint_address }
output "port" { value = aws_elasticache_replication_group.this.port }
