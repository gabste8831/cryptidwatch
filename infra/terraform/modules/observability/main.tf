# Logs da aplicação e alarmes (SEC-70).

variable "name" { type = string }
variable "region" { type = string }
variable "web_acl_name" { type = string }
variable "alb_arn_suffix" { type = string }
variable "target_group_arn_suffixes" { type = map(string) }
variable "db_identifier" { type = string }

resource "aws_cloudwatch_log_group" "app" {
  #checkov:skip=CKV_AWS_158:Criptografado com a chave gerenciada pela AWS; CMK própria fora do escopo do laboratório
  #checkov:skip=CKV_AWS_338:Retenção curta por custo no laboratório
  name              = "/${var.name}/app"
  retention_in_days = 14
}

# Pico de requisições bloqueadas pelo WAF: sinal de ataque em andamento.
resource "aws_cloudwatch_metric_alarm" "waf_blocked" {
  alarm_name          = "${var.name}-waf-bloqueios-altos"
  alarm_description   = "Mais de 50 requisições bloqueadas pelo WAF em 5 minutos"
  namespace           = "AWS/WAFV2"
  metric_name         = "BlockedRequests"
  dimensions          = { WebACL = var.web_acl_name, Region = var.region, Rule = "ALL" }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 50
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${var.name}-alb-erros-5xx"
  alarm_description   = "A aplicação respondeu mais de 10 erros 5xx em 5 minutos"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  dimensions          = { LoadBalancer = var.alb_arn_suffix }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 10
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "unhealthy" {
  for_each            = var.target_group_arn_suffixes
  alarm_name          = "${var.name}-${each.key}-sem-alvos-saudaveis"
  alarm_description   = "Nenhum pod saudável atrás do target group ${each.key}"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HealthyHostCount"
  dimensions          = { LoadBalancer = var.alb_arn_suffix, TargetGroup = each.value }
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
}

resource "aws_cloudwatch_metric_alarm" "db_cpu" {
  alarm_name          = "${var.name}-rds-cpu-alta"
  alarm_description   = "CPU do RDS acima de 80% por 10 minutos"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  dimensions          = { DBInstanceIdentifier = var.db_identifier }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
}

output "app_log_group" { value = aws_cloudwatch_log_group.app.name }
