# Security groups em cadeia (SEC-62).
# Descrições das regras SEM acento: a API da AWS só aceita a-zA-Z0-9 e alguns símbolos.
#
#   internet ──80/443──▶ SG-ALB ──NodePorts──▶ SG-Nós ──5432/6379──▶ SG-Dados
# Cada camada só aceita tráfego da camada anterior, referenciada pelo ID do SG (não por IP).

variable "name" { type = string }
variable "vpc_id" { type = string }
variable "vpc_cidr" { type = string }
variable "node_ports" {
  description = "NodePorts dos Services web e api no Kubernetes."
  type        = map(number)
}

# ---------- SG-ALB ----------
resource "aws_security_group" "alb" {
  #checkov:skip=CKV2_AWS_5:Falso positivo: o SG é usado pelo ALB em outro módulo
  name        = "${var.name}-sg-alb"
  description = "ALB: HTTP e HTTPS da internet"
  vpc_id      = var.vpc_id
  tags        = { Name = "${var.name}-sg-alb" }
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS da internet (passa pelo WAF)"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  #checkov:skip=CKV_AWS_260:A porta 80 só responde com redirecionamento 301 para HTTPS (listener http do ALB)
  security_group_id = aws_security_group.alb.id
  description       = "HTTP da internet (so redireciona para HTTPS)"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

resource "aws_vpc_security_group_egress_rule" "alb_to_nodes" {
  for_each                     = var.node_ports
  security_group_id            = aws_security_group.alb.id
  description                  = "ALB para o NodePort ${each.key}"
  referenced_security_group_id = aws_security_group.nodes.id
  ip_protocol                  = "tcp"
  from_port                    = each.value
  to_port                      = each.value
}

# ---------- SG-Nós ----------
resource "aws_security_group" "nodes" {
  #checkov:skip=CKV2_AWS_5:Falso positivo: o SG é usado pelo launch template dos nós em outro módulo
  name        = "${var.name}-sg-nos"
  description = "Nos do EKS: so recebem do ALB nos NodePorts. Sem SSH."
  vpc_id      = var.vpc_id
  tags        = { Name = "${var.name}-sg-nos" }
}

resource "aws_vpc_security_group_ingress_rule" "nodes_from_alb" {
  for_each                     = var.node_ports
  security_group_id            = aws_security_group.nodes.id
  description                  = "NodePort ${each.key} vindo so do ALB"
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = each.value
  to_port                      = each.value
}

# Saída declarada do SG-Nós: HTTPS (ECR, S3, Secrets Manager), DNS e as portas dos bancos.
# Observação honesta: os nós também carregam o SG do cluster, criado pelo EKS com saída
# liberada (o EKS precisa dela). Quem segura a saída dos pods é a NetworkPolicy (SEC-69).
resource "aws_vpc_security_group_egress_rule" "nodes_https" {
  security_group_id = aws_security_group.nodes.id
  description       = "HTTPS para servicos AWS e registro de imagens"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

resource "aws_vpc_security_group_egress_rule" "nodes_dns_udp" {
  security_group_id = aws_security_group.nodes.id
  description       = "DNS na VPC"
  cidr_ipv4         = var.vpc_cidr
  ip_protocol       = "udp"
  from_port         = 53
  to_port           = 53
}

resource "aws_vpc_security_group_egress_rule" "nodes_dns_tcp" {
  security_group_id = aws_security_group.nodes.id
  description       = "DNS na VPC (TCP)"
  cidr_ipv4         = var.vpc_cidr
  ip_protocol       = "tcp"
  from_port         = 53
  to_port           = 53
}

resource "aws_vpc_security_group_egress_rule" "nodes_to_db" {
  security_group_id            = aws_security_group.nodes.id
  description                  = "PostgreSQL na camada de dados"
  referenced_security_group_id = aws_security_group.data.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

resource "aws_vpc_security_group_egress_rule" "nodes_to_redis" {
  security_group_id            = aws_security_group.nodes.id
  description                  = "Redis na camada de dados"
  referenced_security_group_id = aws_security_group.data.id
  ip_protocol                  = "tcp"
  from_port                    = 6379
  to_port                      = 6379
}

# ---------- SG-Dados ----------
resource "aws_security_group" "data" {
  #checkov:skip=CKV2_AWS_5:Falso positivo: o SG é usado pelo RDS e pelo Redis em outros módulos
  name        = "${var.name}-sg-dados"
  description = "RDS e Redis: so aceitam conexoes dos nos do EKS"
  vpc_id      = var.vpc_id
  tags        = { Name = "${var.name}-sg-dados" }
}

resource "aws_vpc_security_group_ingress_rule" "data_pg" {
  security_group_id            = aws_security_group.data.id
  description                  = "PostgreSQL so dos nos"
  referenced_security_group_id = aws_security_group.nodes.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

resource "aws_vpc_security_group_ingress_rule" "data_redis" {
  security_group_id            = aws_security_group.data.id
  description                  = "Redis so dos nos"
  referenced_security_group_id = aws_security_group.nodes.id
  ip_protocol                  = "tcp"
  from_port                    = 6379
  to_port                      = 6379
}
# SG-Dados não tem nenhuma regra de saída: o banco não inicia conexões.

output "alb_sg_id" { value = aws_security_group.alb.id }
output "nodes_sg_id" { value = aws_security_group.nodes.id }
output "data_sg_id" { value = aws_security_group.data.id }
