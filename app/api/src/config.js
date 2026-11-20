import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

/**
 * Lê a configuração do ambiente. Em produção, os segredos (senha do banco, token do
 * Redis e segredo do JWT) vêm do Secrets Manager via APP_SECRET_ID (SEC-68): os nós do
 * EKS usam a LabRole, então o pod obtém credenciais pelo metadata da instância.
 */
export async function loadConfig(env = process.env) {
  let secrets = {};
  if (env.APP_SECRET_ID) {
    const client = new SecretsManagerClient({ region: env.AWS_REGION || 'us-east-1' });
    const res = await client.send(new GetSecretValueCommand({ SecretId: env.APP_SECRET_ID }));
    secrets = JSON.parse(res.SecretString);
  }
  return buildConfig({ ...env, ...secrets });
}

export function buildConfig(env) {
  const isTest = env.NODE_ENV === 'test';
  const bool = (v, def) => (v === undefined ? def : v === 'true');

  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret || Buffer.byteLength(jwtSecret) < 32) {
    throw new Error('JWT_SECRET ausente ou com menos de 32 bytes (SEC-12)');
  }

  return {
    env: env.NODE_ENV || 'development',
    port: Number(env.PORT || 3000),
    logLevel: env.LOG_LEVEL || (isTest ? 'silent' : 'info'),
    trustProxy: env.TRUST_PROXY === undefined ? false : Number(env.TRUST_PROXY),

    jwtSecret,
    jwtExpiresSec: 3600,
    cookieSecure: bool(env.COOKIE_SECURE, true),
    // SEC-10: custo mínimo 12. Só os testes usam custo baixo para rodar rápido.
    bcryptRounds: isTest ? 4 : Math.max(12, Number(env.BCRYPT_ROUNDS || 12)),

    db: env.DATABASE_URL
      ? { connectionString: env.DATABASE_URL }
      : {
          host: env.DB_HOST || 'localhost',
          port: Number(env.DB_PORT || 5432),
          database: env.DB_NAME || 'cryptidwatch',
          user: env.DB_USER || 'cryptidwatch',
          password: env.DB_PASSWORD,
        },
    // RDS com rds.force_ssl=1: a API valida o certificado com o bundle da AWS.
    dbSsl: bool(env.DB_SSL, false),
    dbSslCaFile: env.DB_SSL_CA_FILE,

    redis: env.REDIS_HOST
      ? {
          host: env.REDIS_HOST,
          port: Number(env.REDIS_PORT || 6379),
          password: env.REDIS_AUTH_TOKEN || undefined,
          tls: bool(env.REDIS_TLS, false),
        }
      : null,

    s3: {
      bucket: env.S3_BUCKET,
      region: env.AWS_REGION || 'us-east-1',
      endpoint: env.S3_ENDPOINT,               // só para MinIO local
      publicEndpoint: env.S3_PUBLIC_ENDPOINT,  // endereço que o navegador enxerga (MinIO local)
    },

    upload: {
      maxBytes: 5 * 1024 * 1024,   // SEC-30
      uploadUrlExpiresSec: 300,    // SEC-30
      getUrlExpiresSec: 300,       // SEC-35
      maxPhotosPerSighting: 3,     // SEC-32
      maxDimension: 4096,          // SEC-33
    },

    limits: {
      login: { max: Number(env.RL_LOGIN_MAX || 5), windowMs: 60_000 },            // SEC-16
      register: { max: Number(env.RL_REGISTER_MAX || 20), windowMs: 3_600_000 },
      sightings: { max: Number(env.RL_SIGHTINGS_MAX || 10), windowMs: 3_600_000 }, // SEC-02
      comments: { max: Number(env.RL_COMMENTS_MAX || 20), windowMs: 3_600_000 },   // SEC-91
    },
  };
}
