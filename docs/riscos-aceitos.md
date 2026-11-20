# Riscos aceitos (scan de IaC com checkov)

O código Terraform passa pelo [checkov](https://www.checkov.io/) na pipeline (SEC-85).
Resultado atual: **168 verificações aprovadas, 0 falhas, 45 exceções justificadas**.

Cada exceção está marcada no próprio recurso com `#checkov:skip=<ID>:<motivo>`, então a
justificativa fica junto do código e aparece no relatório. Elas se dividem em quatro grupos.

## 1. Limitações do AWS Academy Learner Lab

| Verificação | O que pede | Por que não dá | Mitigação adotada |
|---|---|---|---|
| CKV_AWS_341 | Hop limit do IMDS = 1 | Sem IRSA, os pods só pegam credenciais da LabRole pelo metadata do nó, o que exige hop limit 2 | IMDSv2 obrigatório (`http_tokens = required`) e NetworkPolicy limitando os pods |
| CKV_AWS_118 | Enhanced monitoring no RDS | Exige criar uma role IAM | Métricas padrão do CloudWatch + alarme de CPU |
| CKV_AWS_161 | Autenticação IAM no RDS | Exigiria IRSA para cada pod | Senha forte gerada pelo Terraform no Secrets Manager, TLS obrigatório |
| CKV2_AWS_57 | Rotação automática do segredo | Exige Lambda com role própria | O ambiente é recriado a cada sessão (segredos novos a cada `apply`) |
| CKV_AWS_38 / 39 | Endpoint do EKS privado | O runner do GitHub Actions precisa alcançar a API do Kubernetes e não tem IP fixo | Acesso exige credencial IAM; restringível por `eks_public_access_cidrs` |

## 2. Custo (o ambiente é de laboratório, criado e destruído a cada teste)

| Verificação | O que pede | Em produção |
|---|---|---|
| CKV_AWS_157 | RDS Multi-AZ | Ligar (`multi_az = true`) |
| CKV2_AWS_50 | Redis com failover Multi-AZ | 2+ nós com failover; aqui o Redis é só cache (SEC-52) |
| CKV_AWS_338 | Logs retidos por 1 ano | Ajustar retenção à política da empresa |
| CKV_AWS_144 | Replicação do S3 entre regiões | Ligar para os buckets de fotos e de estado |
| CKV_AWS_353 | Performance Insights | Usar instância maior (não existe no db.t3.micro) |

## 3. Criptografia com chave própria (CMK) em vez da chave gerenciada pela AWS

CKV_AWS_158, CKV_AWS_136, CKV_AWS_191, CKV_AWS_149, CKV_AWS_145, CKV_AWS_58.

**Tudo já é criptografado em repouso**: CloudWatch Logs, ECR, ElastiCache, Secrets
Manager e S3, com a chave gerenciada pela AWS. A CMK própria daria controle sobre quem usa
a chave e permitiria revogá-la, mas cada chave custa por mês e exige key policy. Em produção,
seria o próximo passo.

## 4. Decisões de projeto e falsos positivos

| Verificação | Motivo |
|---|---|
| CKV_AWS_150 / CKV_AWS_293 | Deletion protection desligado para o `terraform destroy` funcionar (o laboratório cobra por hora) |
| CKV_AWS_260 | Porta 80 aberta só para redirecionar (301) para HTTPS |
| CKV_AWS_378 | O TLS termina no ALB; dentro da VPC o tráfego até os nós é HTTP, liberado só do SG-ALB para o SG-Nós |
| CKV_AWS_21 | Fotos nunca são sobrescritas (a chave é um UUID), então versionamento não protege nada |
| CKV2_AWS_62 | O processamento das fotos é síncrono na API, sem eventos do S3 |
| CKV_AWS_18 | Acesso às fotos é auditado pela API (SHA-256 + `audit_log`); o ALB tem log de acesso próprio |
| CKV2_AWS_15 | O Auto Scaling Group é criado e gerenciado pelo EKS |
| CKV2_AWS_5 | Falso positivo: os security groups são usados em outros módulos |
| CKV2_AWS_76 | Log4j já coberto pelo `AWSManagedRulesKnownBadInputsRuleSet` (o checkov não resolve o bloco `dynamic`) |

## Corrigido por causa do scan

Itens que o primeiro scan apontou e foram **corrigidos** em vez de aceitos:

- Logs do plano de controle do EKS: todos os tipos ligados (antes só api, audit e authenticator).
- Logs de acesso do ALB num bucket próprio, criptografado, com expiração de 30 dias.
- Ciclo de vida no bucket de estado: versões antigas por 90 dias e limpeza de uploads incompletos.
