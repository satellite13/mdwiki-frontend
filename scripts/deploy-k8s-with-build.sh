#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHART_DIR="${CHART_DIR:-${ROOT_DIR}/deploy/helm/mdwiki-frontend}"

RELEASE_NAME="${RELEASE_NAME:-mdwiki-frontend}"
NAMESPACE="${NAMESPACE:-mdwiki}"
VALUES_FILE="${VALUES_FILE:-}"
TIMEOUT="${TIMEOUT:-5m}"

IMAGE_REPOSITORY="${IMAGE_REPOSITORY:-mdwiki-frontend}"
DEFAULT_SHA="$(git -C "${ROOT_DIR}" rev-parse --short HEAD)"
VERSION_TAG="$(git -C "${ROOT_DIR}" describe --tags --always)"
DEFAULT_DIRTY_SUFFIX=""
if [[ -n "$(git -C "${ROOT_DIR}" status --porcelain)" ]]; then
  DEFAULT_DIRTY_SUFFIX="-dirty"
fi
# Image tag is the git version tag (e.g. v0.1.0 or v0.1.0-2-g9d37397).
DEFAULT_IMAGE_TAG="${VERSION_TAG}${DEFAULT_DIRTY_SUFFIX}"
IMAGE_TAG="${IMAGE_TAG:-${DEFAULT_IMAGE_TAG}}"

is_remote_repository() {
  local repo="$1"
  # "repo" (no slash) is treated as local image.
  if [[ "${repo}" != */* ]]; then
    return 1
  fi
  # "<host>/<name>" where host looks like registry host: remote.
  local first_segment="${repo%%/*}"
  if [[ "${first_segment}" == *.* || "${first_segment}" == *:* || "${first_segment}" == "localhost" ]]; then
    return 0
  fi
  # Namespace-style repos (e.g. "user/repo") are also remote by default.
  return 0
}

DEFAULT_IMAGE_PULL_POLICY="IfNotPresent"
if is_remote_repository "${IMAGE_REPOSITORY}"; then
  DEFAULT_IMAGE_PULL_POLICY="Always"
fi
IMAGE_PULL_POLICY="${IMAGE_PULL_POLICY:-${DEFAULT_IMAGE_PULL_POLICY}}"

DEFAULT_PUSH_IMAGE="false"
if is_remote_repository "${IMAGE_REPOSITORY}"; then
  DEFAULT_PUSH_IMAGE="true"
fi
PUSH_IMAGE="${PUSH_IMAGE:-${DEFAULT_PUSH_IMAGE}}"

if [[ ! -d "${CHART_DIR}" ]]; then
  echo "Chart directory not found: ${CHART_DIR}" >&2
  exit 1
fi

echo "Building image ${IMAGE_REPOSITORY}:${IMAGE_TAG}"
docker build \
  --build-arg "APP_GIT_SHA=${DEFAULT_SHA}" \
  --build-arg "APP_VERSION_TAG=${VERSION_TAG}" \
  -t "${IMAGE_REPOSITORY}:${IMAGE_TAG}" \
  "${ROOT_DIR}"

if [[ "${PUSH_IMAGE}" == "true" ]]; then
  echo "Pushing image ${IMAGE_REPOSITORY}:${IMAGE_TAG}"
  docker push "${IMAGE_REPOSITORY}:${IMAGE_TAG}"
else
  echo "Skipping push (PUSH_IMAGE=${PUSH_IMAGE})"
fi

echo "Using image.pullPolicy=${IMAGE_PULL_POLICY}"

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
