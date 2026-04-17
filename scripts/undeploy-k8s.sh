#!/usr/bin/env bash
set -euo pipefail

RELEASE_NAME="${RELEASE_NAME:-mdwiki-frontend}"
NAMESPACE="${NAMESPACE:-mdwiki}"

echo "Uninstalling release ${RELEASE_NAME} from namespace ${NAMESPACE}"
helm uninstall "${RELEASE_NAME}" --namespace "${NAMESPACE}" || true

echo "Undeploy completed"
