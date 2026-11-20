FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Só dependências de produção na imagem final (menos superfície de ataque).
RUN npm ci --omit=dev --no-audit --no-fund --ignore-scripts

FROM node:26-alpine
ENV NODE_ENV=production \
    DB_SSL_CA_FILE=/app/certs/rds-global-bundle.pem
# Imagem final sem gerenciador de pacotes: a API não usa npm/yarn em produção, e eles
# carregam dependências próprias com CVEs (achado do Trivy). Também atualiza o Alpine.
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
# Bundle de CAs da AWS: a API valida o certificado TLS do RDS (SEC-66).
# --chmod=644: arquivo baixado por ADD vem com permissão 600, e no Kubernetes a API roda com
# UID 10001 (não o dono), então não conseguiria ler. O bundle é público; só leitura para todos.
# A pasta é criada antes porque a que o ADD cria também vem fechada para outros usuários.
RUN install -d -m 755 /app/certs
ADD --chown=node:node --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certs/rds-global-bundle.pem
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node sql ./sql
COPY --chown=node:node src ./src
# SEC-72: roda como usuário sem privilégios.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "src/server.js"]
