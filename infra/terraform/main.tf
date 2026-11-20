# CryptidWatch na AWS. Um `terraform apply` recria tudo do zero: este código é o plano de
# recuperação de desastre (SEC-60). Ordem: rede → segurança → dados → cluster → entrada.

locals {
  name = var.project
  # NodePorts fixos dos Services do Kubernetes (k8s/*.yaml usam os mesmos números).
  node_ports = { web = 30080, api = 30300 }
}

module "vpc" {
  source = "./modules/vpc"
  name   = local.name
  cidr   = var.vpc_cidr
  azs    = var.azs
  region = var.region
}

module "security_groups" {
  source     = "./modules/security-groups"
  name       = local.name
  vpc_id     = module.vpc.vpc_id
  vpc_cidr   = module.vpc.vpc_cidr
  node_ports = local.node_ports
}

module "secrets" {
  source = "./modules/secrets"
  name   = local.name
}

module "ecr" {
  source = "./modules/ecr"
  name   = local.name
}

module "rds" {
  source            = "./modules/rds"
  name              = local.name
  subnet_ids        = module.vpc.data_subnet_ids
  security_group_id = module.security_groups.data_sg_id
  password          = module.secrets.db_password
}

module "redis" {
  source            = "./modules/redis"
  name              = local.name
  subnet_ids        = module.vpc.data_subnet_ids
  security_group_id = module.security_groups.data_sg_id
  auth_token        = module.secrets.redis_auth_token
}

module "eks" {
  source                  = "./modules/eks"
  name                    = local.name
  kubernetes_version      = var.eks_version
  subnet_ids              = module.vpc.app_subnet_ids
  nodes_security_group_id = module.security_groups.nodes_sg_id
  instance_type           = var.node_instance_type
  node_count              = var.node_count
  public_access_cidrs     = var.eks_public_access_cidrs
}

module "alb" {
  source                = "./modules/alb-waf-acm"
  name                  = local.name
  vpc_id                = module.vpc.vpc_id
  public_subnet_ids     = module.vpc.public_subnet_ids
  alb_security_group_id = module.security_groups.alb_sg_id
  node_ports            = local.node_ports
  node_asg_name         = module.eks.node_asg_names[0]
  waf_rate_limit        = var.waf_rate_limit
}

module "photos" {
  source          = "./modules/s3-fotos"
  name            = local.name
  allowed_origins = ["https://${module.alb.alb_dns_name}"]
}

module "observability" {
  source                    = "./modules/observability"
  name                      = local.name
  region                    = var.region
  web_acl_name              = module.alb.web_acl_name
  alb_arn_suffix            = module.alb.alb_arn_suffix
  target_group_arn_suffixes = module.alb.target_group_arn_suffixes
  db_identifier             = module.rds.identifier
}
