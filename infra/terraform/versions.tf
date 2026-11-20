terraform {
  required_version = ">= 1.10"

  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 6.0" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
    tls    = { source = "hashicorp/tls", version = "~> 4.0" }
  }

  # Estado remoto no bucket criado pelo bootstrap. O nome do bucket tem o ID da conta,
  # então vai no init:  terraform init -backend-config="bucket=cryptidwatch-tfstate-<conta>"
  # use_lockfile: trava nativa do S3 (sem DynamoDB) para dois applies não correrem juntos.
  backend "s3" {
    key          = "cryptidwatch/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = { Project = var.project, ManagedBy = "terraform" }
  }
}
