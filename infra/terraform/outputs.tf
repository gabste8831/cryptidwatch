output "site_url" {
  description = "Endereço do site (certificado autoassinado: o navegador vai pedir confirmação)."
  value       = "https://${module.alb.alb_dns_name}"
}

output "cluster_name" { value = module.eks.cluster_name }
output "ecr_repositories" { value = module.ecr.repository_urls }

# Valores que o deploy do Kubernetes injeta no ConfigMap da API (nenhum é segredo).
output "app_config" {
  value = {
    AWS_REGION    = var.region
    APP_SECRET_ID = module.secrets.secret_name
    DB_HOST       = module.rds.address
    DB_PORT       = tostring(module.rds.port)
    DB_NAME       = "cryptidwatch"
    DB_USER       = "cryptidwatch"
    DB_SSL        = "true"
    REDIS_HOST    = module.redis.endpoint
    REDIS_PORT    = tostring(module.redis.port)
    REDIS_TLS     = "true"
    S3_BUCKET     = module.photos.bucket
    PHOTO_ORIGIN  = "https://${module.photos.regional_domain}"
  }
}

output "waf_log_group" { value = module.alb.waf_log_group }
output "app_log_group" { value = module.observability.app_log_group }
