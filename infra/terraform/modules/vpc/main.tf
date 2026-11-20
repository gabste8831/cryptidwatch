# VPC em 3 camadas e 2 AZs (SEC-61):
#   públicas  10.0.1.0/24, 10.0.2.0/24   → ALB e NAT Gateway (rota para o Internet Gateway)
#   app       10.0.11.0/24, 10.0.12.0/24 → nós do EKS (saída só pelo NAT; S3 pelo VPC Endpoint)
#   dados     10.0.21.0/24, 10.0.22.0/24 → RDS e Redis, SEM rota para a internet

variable "name" { type = string }
variable "cidr" { type = string }
variable "azs" { type = list(string) }
variable "region" { type = string }

locals {
  public_cidrs = [for i, _ in var.azs : cidrsubnet(var.cidr, 8, 1 + i)]
  app_cidrs    = [for i, _ in var.azs : cidrsubnet(var.cidr, 8, 11 + i)]
  data_cidrs   = [for i, _ in var.azs : cidrsubnet(var.cidr, 8, 21 + i)]
}

resource "aws_vpc" "this" {
  cidr_block           = var.cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "${var.name}-vpc" }
}

# Fecha o security group padrão da VPC: nada usa ele, e sem regras ele não libera nada.
resource "aws_default_security_group" "default" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.name}-default-fechado" }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.name}-igw" }
}

resource "aws_subnet" "public" {
  count                   = length(var.azs)
  vpc_id                  = aws_vpc.this.id
  cidr_block              = local.public_cidrs[count.index]
  availability_zone       = var.azs[count.index]
  map_public_ip_on_launch = false # nem as públicas dão IP automático; só ALB e NAT ficam aqui
  tags = {
    Name                     = "${var.name}-publica-${var.azs[count.index]}"
    Tier                     = "publica"
    "kubernetes.io/role/elb" = "1"
  }
}

resource "aws_subnet" "app" {
  count             = length(var.azs)
  vpc_id            = aws_vpc.this.id
  cidr_block        = local.app_cidrs[count.index]
  availability_zone = var.azs[count.index]
  tags = {
    Name                              = "${var.name}-app-${var.azs[count.index]}"
    Tier                              = "app"
    "kubernetes.io/role/internal-elb" = "1"
  }
}

resource "aws_subnet" "data" {
  count             = length(var.azs)
  vpc_id            = aws_vpc.this.id
  cidr_block        = local.data_cidrs[count.index]
  availability_zone = var.azs[count.index]
  tags              = { Name = "${var.name}-dados-${var.azs[count.index]}", Tier = "dados" }
}

# Um NAT só (economia no Learner Lab). Em produção seria um por AZ.
resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = { Name = "${var.name}-nat-eip" }
}

resource "aws_nat_gateway" "this" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  tags          = { Name = "${var.name}-nat" }
  depends_on    = [aws_internet_gateway.this]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
  tags = { Name = "${var.name}-rt-publica" }
}

resource "aws_route_table" "app" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this.id
  }
  tags = { Name = "${var.name}-rt-app" }
}

# Tabela da camada de dados: só a rota local da VPC (nenhuma saída para a internet).
resource "aws_route_table" "data" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.name}-rt-dados-sem-internet" }
}

resource "aws_route_table_association" "public" {
  count          = length(var.azs)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "app" {
  count          = length(var.azs)
  subnet_id      = aws_subnet.app[count.index].id
  route_table_id = aws_route_table.app.id
}

resource "aws_route_table_association" "data" {
  count          = length(var.azs)
  subnet_id      = aws_subnet.data[count.index].id
  route_table_id = aws_route_table.data.id
}

# VPC Endpoint (gateway) do S3: os pods falam com o bucket de fotos sem passar pelo NAT.
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.app.id]
  tags              = { Name = "${var.name}-vpce-s3" }
}

# Flow logs: registro do tráfego aceito e rejeitado na VPC (evidência e investigação).
resource "aws_cloudwatch_log_group" "flow" {
  #checkov:skip=CKV_AWS_158:Criptografado com a chave gerenciada pela AWS; CMK própria fora do escopo do laboratório
  #checkov:skip=CKV_AWS_338:Retenção curta por custo no laboratório
  name              = "/${var.name}/vpc-flow-logs"
  retention_in_days = 14
}

data "aws_iam_role" "lab" {
  name = "LabRole"
}

resource "aws_flow_log" "this" {
  vpc_id               = aws_vpc.this.id
  traffic_type         = "ALL"
  log_destination_type = "cloud-watch-logs"
  log_destination      = aws_cloudwatch_log_group.flow.arn
  iam_role_arn         = data.aws_iam_role.lab.arn
}

output "vpc_id" { value = aws_vpc.this.id }
output "vpc_cidr" { value = aws_vpc.this.cidr_block }
output "public_subnet_ids" { value = aws_subnet.public[*].id }
output "app_subnet_ids" { value = aws_subnet.app[*].id }
output "data_subnet_ids" { value = aws_subnet.data[*].id }
output "s3_endpoint_id" { value = aws_vpc_endpoint.s3.id }
