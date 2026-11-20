# Entrada da aplicação: WAF → ALB (HTTPS) → NodePorts dos nós do EKS.
#   /        → Service web (Nginx + React)
#   /api/*   → Service api (Express)

variable "name" { type = string }
variable "vpc_id" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "alb_security_group_id" { type = string }
variable "node_ports" { type = map(number) }
variable "node_asg_name" { type = string }
variable "waf_rate_limit" { type = number }

# ---------- Certificado (SEC-65) ----------
# Sem domínio no Learner Lab: certificado autoassinado gerado aqui e importado no ACM.
# O navegador vai avisar que não confia, mas o tráfego fica criptografado (TLS 1.2+).
resource "tls_private_key" "this" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_self_signed_cert" "this" {
  private_key_pem       = tls_private_key.this.private_key_pem
  validity_period_hours = 24 * 90
  allowed_uses          = ["key_encipherment", "digital_signature", "server_auth"]
  dns_names             = ["*.elb.amazonaws.com", "cryptidwatch.local"]
  subject {
    common_name  = "cryptidwatch.local"
    organization = "CryptidWatch (UNIDAVI)"
  }
}

resource "aws_acm_certificate" "this" {
  private_key      = tls_private_key.this.private_key_pem
  certificate_body = tls_self_signed_cert.this.cert_pem
  lifecycle { create_before_destroy = true }
}

# ---------- Logs de acesso do ALB (cada requisição: IP, caminho, status, regra do WAF) ----------
data "aws_caller_identity" "current" {}
data "aws_elb_service_account" "this" {}

# Criado via CloudFormation por causa da restrição do Learner Lab (ver modules/s3-bucket-cfn).
# Já nasce com SSE-S3 (o ALB não aceita KMS) e sem acesso público.
module "alb_logs" {
  source      = "../s3-bucket-cfn"
  name        = "${var.name}-alb-logs-${data.aws_caller_identity.current.account_id}"
  description = "Logs de acesso do ALB do CryptidWatch"
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = module.alb_logs.name
  rule {
    id     = "expira-logs"
    status = "Enabled"
    filter {}
    expiration { days = 30 }
    abort_incomplete_multipart_upload { days_after_initiation = 1 }
  }
}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = module.alb_logs.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EntregaDeLogsDoALB"
        Effect    = "Allow"
        Principal = { AWS = data.aws_elb_service_account.this.arn }
        Action    = "s3:PutObject"
        Resource  = "${module.alb_logs.arn}/alb/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
      },
      {
        Sid       = "SomenteHTTPS"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [module.alb_logs.arn, "${module.alb_logs.arn}/*"]
        Condition = { Bool = { "aws:SecureTransport" = "false" } }
      },
    ]
  })
}

# ---------- ALB ----------
resource "aws_lb" "this" {
  #checkov:skip=CKV_AWS_150:Deletion protection desligado para o terraform destroy do laboratório
  #checkov:skip=CKV2_AWS_76:Log4j coberto pelo AWSManagedRulesKnownBadInputsRuleSet (declarado via dynamic, que o checkov não resolve)
  name                       = "${var.name}-alb"
  load_balancer_type         = "application"
  internal                   = false
  subnets                    = var.public_subnet_ids
  security_groups            = [var.alb_security_group_id]
  drop_invalid_header_fields = true # descarta cabeçalhos HTTP malformados (request smuggling)
  enable_deletion_protection = false
  idle_timeout               = 60

  access_logs {
    bucket  = module.alb_logs.name
    prefix  = "alb"
    enabled = true
  }

  depends_on = [aws_s3_bucket_policy.alb_logs]
}

resource "aws_lb_target_group" "this" {
  #checkov:skip=CKV_AWS_378:TLS termina no ALB; do ALB aos nós o tráfego é HTTP dentro da VPC, liberado só pelo SG-ALB → SG-Nós
  for_each    = var.node_ports
  name        = "${var.name}-tg-${each.key}"
  port        = each.value
  protocol    = "HTTP"
  target_type = "instance"
  vpc_id      = var.vpc_id

  health_check {
    path                = each.key == "api" ? "/api/health" : "/healthz"
    matcher             = "200"
    interval            = 15
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 20
}

# Os nós do node group entram nos dois target groups automaticamente.
resource "aws_autoscaling_attachment" "this" {
  #checkov:skip=CKV2_AWS_15:O ASG é criado e gerenciado pelo EKS (node group), que cuida da saúde dos nós
  for_each               = aws_lb_target_group.this
  autoscaling_group_name = var.node_asg_name
  lb_target_group_arn    = each.value.arn
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06" # só TLS 1.2 e 1.3
  certificate_arn   = aws_acm_certificate.this.arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this["web"].arn
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this["api"].arn
  }
  condition {
    path_pattern { values = ["/api/*"] }
  }
}

# ---------- WAF (SEC-64) ----------
locals {
  managed_rules = [
    # [nome, prioridade]
    ["AWSManagedRulesAmazonIpReputationList", 10], # IPs conhecidos por bots e ataques
    ["AWSManagedRulesCommonRuleSet", 20],          # OWASP básico, inclui XSS
    ["AWSManagedRulesSQLiRuleSet", 30],            # SQL injection
    ["AWSManagedRulesKnownBadInputsRuleSet", 40],  # Log4Shell, exploits conhecidos
  ]
}

resource "aws_wafv2_web_acl" "this" {
  name  = "${var.name}-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  # Primeiro o rate limit: flood de um IP é cortado antes das outras regras.
  rule {
    name     = "rate-limit-por-ip"
    priority = 1
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit                 = var.waf_rate_limit
        aggregate_key_type    = "IP"
        evaluation_window_sec = 300
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate-limit-por-ip"
      sampled_requests_enabled   = true
    }
  }

  dynamic "rule" {
    for_each = local.managed_rules
    content {
      name     = rule.value[0]
      priority = rule.value[1]
      override_action {
        none {} # usa a ação da AWS (bloquear)
      }
      statement {
        managed_rule_group_statement {
          vendor_name = "AWS"
          name        = rule.value[0]
        }
      }
      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = rule.value[0]
        sampled_requests_enabled   = true
      }
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name}-waf"
    sampled_requests_enabled   = true
  }
}

resource "aws_wafv2_web_acl_association" "this" {
  resource_arn = aws_lb.this.arn
  web_acl_arn  = aws_wafv2_web_acl.this.arn
}

# Logs do WAF no CloudWatch (SEC-70). O nome precisa começar com "aws-waf-logs-".
resource "aws_cloudwatch_log_group" "waf" {
  #checkov:skip=CKV_AWS_158:Criptografado com a chave gerenciada pela AWS; CMK própria fora do escopo do laboratório
  #checkov:skip=CKV_AWS_338:Retenção de 30 dias por custo no laboratório
  name              = "aws-waf-logs-${var.name}"
  retention_in_days = 30
}

resource "aws_wafv2_web_acl_logging_configuration" "this" {
  resource_arn            = aws_wafv2_web_acl.this.arn
  log_destination_configs = [aws_cloudwatch_log_group.waf.arn]

  # Nunca grava cookie de sessão nem cabeçalho de autorização no log.
  redacted_fields {
    single_header { name = "cookie" }
  }
  redacted_fields {
    single_header { name = "authorization" }
  }
}

output "alb_dns_name" { value = aws_lb.this.dns_name }
output "alb_arn_suffix" { value = aws_lb.this.arn_suffix }
output "web_acl_name" { value = aws_wafv2_web_acl.this.name }
output "waf_log_group" { value = aws_cloudwatch_log_group.waf.name }
output "target_group_arn_suffixes" {
  value = { for k, tg in aws_lb_target_group.this : k => tg.arn_suffix }
}
