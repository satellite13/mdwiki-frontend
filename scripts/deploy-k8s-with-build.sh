#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHART_DIR="${CHART_DIR:-${ROOT_DIR}/deploy/helm/mdwiki-frontend}"

RELEASE_NAME="${RELEASE_NAME:-mdwiki-frontend}"
NAMESPACE="${NAMESPACE:-mdwiki}"
VALUES_FILE="${VALUES_FILE:-}"
TIMEOUT="${TIMEOUT:-5m}"

IMAGE_REPOSITORY="${IMAGE_REPOSITORY:-mdwiki-frontend}"
IMAGE_TAG="${IMAGE_TAG:-$(git -C "${ROOT_DIR}" rev-parse --short HEAD)}"
IMAGE_PULL_POLICY="${IMAGE_PULL_POLICY:-IfNotPresent}"

if [[ ! -d "${CHART_DIR}" ]]; then
  echo "Chart directory not found: ${CHART_DIR}" >&2
  exit 1
fi

echo "Building image ${IMAGE_REPOSITORY}:${IMAGE_TAG}"
docker build -t "${IMAGE_REPOSITORY}:${IMAGE_TAG}" "${ROOT_DIR}"

HELM_ARGS=(
  upgrade
  --install
  "${RELEASE_NAME}"
  "${CHART_DIR}"
  --namespace "${NAMESPACE}"
  --create-namespace
  --wait
  --timeout "${TIMEOUT}"
  --set "image.repository=${IMAGE_REPOSITORY}"
  --set "image.tag=${IMAGE_TAG}"
  --set "image.pullPolicy=${IMAGE_PULL_POLICY}"
)

if [[ -n "${VALUES_FILE}" ]]; then
  HELM_ARGS+=(--values "${VALUES_FILE}")
fi

echo "Deploying ${RELEASE_NAME} to namespace ${NAMESPACE}"
helm "${HELM_ARGS[@]}"

DEPLOYMENT_NAME="${DEPLOYMENT_NAME:-${RELEASE_NAME}-mdwiki-frontend}"
echo "Waiting for deployment/${DEPLOYMENT_NAME} rollout"
kubectl rollout status "deployment/${DEPLOYMENT_NAME}" -n "${NAMESPACE}" --timeout="${TIMEOUT}"

echo "Deployment image:"
kubectl -n "${NAMESPACE}" get deployment "${DEPLOYMENT_NAME}" \
  -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'

echo "Pod image IDs:"
kubectl -n "${NAMESPACE}" get pods -l app.kubernetes.io/name=mdwiki-frontend \
  -o jsonpath='{range .items[*]}{.metadata.name}{" => "}{.status.containerStatuses[0].imageID}{"\n"}{end}'

echo "Deployment finished successfully"
