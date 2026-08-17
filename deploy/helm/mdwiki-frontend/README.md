# mdwiki-frontend Helm chart

Русская версия: `README.ru.md`

The chart deploys the Vue frontend (nginx) and proxies `/api/*` to the backend service in the cluster.

## Quick start

```bash
# Usually deployed via scripts/deploy-k8s-with-build.sh
# (image tag = git describe, e.g. v0.1.0-3-g7dc9ede).
helm upgrade --install mdwiki-frontend ./deploy/helm/mdwiki-frontend \
  --namespace mdwiki \
  --create-namespace \
  --set image.repository=mdwiki-frontend \
  --set image.tag=v0.1.0
```

Local cluster: `VALUES_FILE=./values-local.yaml ./scripts/deploy-k8s-with-build.sh`
from the repo root.

## Required settings

- `image.repository`
- `image.tag` (prefer `git describe --tags --always`)

## Useful settings

- `api.upstream` (default `http://mdwiki-api-mdwiki-api:8080`)
- `ingress.enabled` / `ingress.hosts`
