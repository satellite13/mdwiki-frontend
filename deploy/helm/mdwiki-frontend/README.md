# mdwiki-frontend Helm chart

Chart разворачивает Vue frontend (nginx) и проксирует `/api/*` на backend-сервис в кластере.

## Быстрый старт

```bash
helm upgrade --install mdwiki-frontend ./deploy/helm/mdwiki-frontend \
  --namespace mdwiki \
  --create-namespace \
  --set image.repository=mdwiki-frontend \
  --set image.tag=local
```

## Обязательные параметры

- `image.repository`
- `image.tag`

## Полезные параметры

- `api.upstream` (по умолчанию `http://mdwiki-api-mdwiki-api:8080`)
- `ingress.enabled` / `ingress.hosts`
