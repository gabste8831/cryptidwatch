variable "project" {
  type    = string
  default = "cryptidwatch"
}

variable "region" {
  type    = string
  default = "us-east-1"
}

# O EKS não aceita algumas AZs do us-east-1 (ex.: us-east-1e), então fixamos duas que funcionam.
variable "azs" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b"]
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "node_instance_type" {
  description = "Tipo das instâncias dos nós do EKS (o Learner Lab limita os tipos disponíveis)."
  type        = string
  default     = "t3.medium"
}

variable "node_count" {
  type    = number
  default = 2
}

variable "eks_version" {
  description = "Use sempre uma versão em suporte PADRÃO: em suporte estendido o plano de controle custa 6x mais (US$ 0,60/h). Confira com: aws eks describe-cluster-versions"
  type        = string
  default     = "1.36"
}

variable "eks_public_access_cidrs" {
  description = "Quem alcança o endpoint público da API do Kubernetes. O runner do GitHub Actions não tem IP fixo, então o padrão é aberto; restrinja ao seu IP se for rodar o deploy só da sua máquina."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "waf_rate_limit" {
  description = "Máximo de requisições por IP em 5 minutos antes do bloqueio (SEC-64)."
  type        = number
  default     = 300
}
