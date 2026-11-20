# Etapa 1: build do React.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# Etapa 2: só os arquivos estáticos num Nginx sem root (SEC-72).
# Linha mainline (1.31): a estável 1.30.6 ainda tem CVEs críticas que só a 1.30.7
# corrige, e essa versão não tem imagem publicada. O Trivy da pipeline avisa quando a base envelhecer.
FROM nginxinc/nginx-unprivileged:1.31.7-alpine
USER root
# Aplica as correções de segurança do Alpine publicadas depois da imagem base.
RUN apk upgrade --no-cache
ENV API_UPSTREAM=http://api:3000 \
    PHOTO_ORIGIN=""
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
USER 101
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
