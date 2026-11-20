# Cluster EKS nas subnets privadas de aplicação.
# Learner Lab: não dá para criar roles, então cluster e nós usam a LabRole existente.
# Sem IRSA → sem AWS Load Balancer Controller: o ALB é criado pelo Terraform (módulo
# alb-waf-acm) e aponta para os nós via NodePort.

variable "name" { type = string }
variable "kubernetes_version" { type = string }
variable "subnet_ids" { type = list(string) }
variable "nodes_security_group_id" { type = string }
variable "instance_type" { type = string }
variable "node_count" { type = number }
variable "public_access_cidrs" { type = list(string) }

data "aws_iam_role" "lab" {
  name = "LabRole"
}

resource "aws_cloudwatch_log_group" "cluster" {
  #checkov:skip=CKV_AWS_158:Criptografado com a chave gerenciada pela AWS; CMK própria fora do escopo do laboratório
  #checkov:skip=CKV_AWS_338:Retenção curta por custo no laboratório
  name              = "/aws/eks/${var.name}/cluster"
  retention_in_days = 14
}

resource "aws_eks_cluster" "this" {
  #checkov:skip=CKV_AWS_38:Endpoint público necessário para o runner do GitHub Actions (IP variável). Restringível por var.eks_public_access_cidrs. Ver docs/riscos-aceitos.md
  #checkov:skip=CKV_AWS_39:Mesmo motivo do CKV_AWS_38; o acesso exige credencial IAM válida
  #checkov:skip=CKV_AWS_58:Nenhum segredo da aplicação fica em Secret do Kubernetes (estão no Secrets Manager)
  name     = var.name
  version  = var.kubernetes_version
  role_arn = data.aws_iam_role.lab.arn

  vpc_config {
    subnet_ids              = var.subnet_ids
    endpoint_private_access = true
    endpoint_public_access  = true # o pipeline do GitHub Actions faz o deploy por aqui
    public_access_cidrs     = var.public_access_cidrs
  }

  access_config {
    authentication_mode = "API_AND_CONFIG_MAP"
    # Quem roda o apply (as credenciais do Learner Lab) vira admin do cluster.
    bootstrap_cluster_creator_admin_permissions = true
  }

  # Auditoria do plano de controle: quem chamou a API do Kubernetes e o que fez.
  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  depends_on = [aws_cloudwatch_log_group.cluster]
}

# Add-on de rede com NetworkPolicy ligado (SEC-69): é ele que aplica o default-deny.
resource "aws_eks_addon" "vpc_cni" {
  cluster_name                = aws_eks_cluster.this.name
  addon_name                  = "vpc-cni"
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"
  configuration_values        = jsonencode({ enableNetworkPolicy = "true" })
}

# Launch template: põe o SG-Nós nos nós e exige IMDSv2.
resource "aws_launch_template" "nodes" {
  #checkov:skip=CKV_AWS_341:Hop limit 2 é necessário para os pods obterem a LabRole via IMDSv2 (sem IRSA no Learner Lab)
  name_prefix = "${var.name}-nodes-"

  # O SG do cluster (comunicação com o plano de controle e entre nós) + o SG-Nós (ALB).
  vpc_security_group_ids = [
    aws_eks_cluster.this.vpc_config[0].cluster_security_group_id,
    var.nodes_security_group_id,
  ]

  # IMDSv2 obrigatório. hop limit 2 porque os pods pegam as credenciais da LabRole pelo
  # metadata do nó (não há IRSA no Learner Lab).
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size = 20
      volume_type = "gp3"
      encrypted   = true
    }
  }

  tag_specifications {
    resource_type = "instance"
    tags          = { Name = "${var.name}-node" }
  }
}

resource "aws_eks_node_group" "this" {
  cluster_name    = aws_eks_cluster.this.name
  node_group_name = "${var.name}-nodes"
  node_role_arn   = data.aws_iam_role.lab.arn
  subnet_ids      = var.subnet_ids # privadas: nós sem IP público (SEC-63)
  instance_types  = [var.instance_type]
  ami_type        = "AL2023_x86_64_STANDARD"

  scaling_config {
    desired_size = var.node_count
    min_size     = 1
    max_size     = var.node_count + 1
  }

  update_config { max_unavailable = 1 }

  launch_template {
    id      = aws_launch_template.nodes.id
    version = aws_launch_template.nodes.latest_version
  }

  # Sem remote_access: nenhum acesso SSH aos nós (SEC-63).

  depends_on = [aws_eks_addon.vpc_cni]
}

resource "aws_eks_addon" "coredns" {
  cluster_name                = aws_eks_cluster.this.name
  addon_name                  = "coredns"
  resolve_conflicts_on_create = "OVERWRITE"
  depends_on                  = [aws_eks_node_group.this]
}

resource "aws_eks_addon" "kube_proxy" {
  cluster_name                = aws_eks_cluster.this.name
  addon_name                  = "kube-proxy"
  resolve_conflicts_on_create = "OVERWRITE"
}

output "cluster_name" { value = aws_eks_cluster.this.name }
output "cluster_endpoint" { value = aws_eks_cluster.this.endpoint }
output "cluster_security_group_id" { value = aws_eks_cluster.this.vpc_config[0].cluster_security_group_id }
output "node_asg_names" {
  value = flatten([for r in aws_eks_node_group.this.resources : [for g in r.autoscaling_groups : g.name]])
}
