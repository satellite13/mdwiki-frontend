# mdwiki-frontend Helm chart

English version: `README.md`

Chart разворачивает Vue frontend (nginx) и проксирует `/api/*` на backend-сервис в кластере.

## Быстрый старт

```bash
# Обычно деплоят через scripts/deploy-k8s-with-build.sh
# (тег образа = git describe, например v0.1.0-3-g7dc9ede).
helm upgrade --install mdwiki-frontend ./deploy/helm/mdwiki-frontend \
  --namespace mdwiki \
  --create-namespace \
  --set image.repository=mdwiki-frontend \
  --set image.tag=v0.1.0
```

Локальный кластер: `VALUES_FILE=./values-local.yaml ./scripts/deploy-k8s-with-build.sh`
из корня репозитория.

## Обязательные параметры

- `image.repository`
- `image.tag` (предпочтительно `git describe --tags --always`)

## Полезные параметры

- `api.upstream` (по умолчанию `http://mdwiki-api-mdwiki-api:8080`)
- `ingress.enabled` / `ingress.hosts`
