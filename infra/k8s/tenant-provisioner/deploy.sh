#!/usr/bin/env bash
set -euo pipefail

# Builds, imports, and applies the saas-workers tenant-provisioner Deployment.
#
# Replaces the old ad-hoc flow (`docker build` + manual `kubectl set image`)
# that left 11 stale ReplicaSets behind with no record in git of what was
# actually running. See docs/infra/tenant-provisioner.md for the full
# picture of why this component is separate from the docker-compose
# `workers` service.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
NAMESPACE=saas-platform
DEPLOYMENT=saas-workers
IMAGE_NAME=saas-platform-workers

cd "$ROOT"

SHA="$(git rev-parse --short HEAD)"
TAG="k8s-deploy-${SHA}"

echo "→ Building ${IMAGE_NAME}:${TAG} from infra/docker/workers.Dockerfile"
docker build -f infra/docker/workers.Dockerfile -t "${IMAGE_NAME}:${TAG}" .

echo "→ Importing image into k3s's containerd (this host uses k3s, not docker, as the kubelet runtime)"
docker save "${IMAGE_NAME}:${TAG}" | sudo k3s ctr images import -

cd "$SCRIPT_DIR"

if [[ -f secret.env ]]; then
  echo "→ Applying saas-workers-env Secret from secret.env"
  kubectl create secret generic saas-workers-env \
    -n "$NAMESPACE" \
    --from-env-file=secret.env \
    --dry-run=client -o yaml | kubectl apply -f -
else
  echo "⚠  secret.env not found — skipping Secret apply (see secret.env.example)."
  echo "   If saas-workers-env doesn't already exist in-cluster, the pod will fail to start."
fi

echo "→ Applying namespace/serviceaccount/rbac/deployment via kustomize"
kubectl kustomize . | sed "s|${IMAGE_NAME}:k8s-deploy\$|${IMAGE_NAME}:${TAG}|" | kubectl apply -f -

echo "→ Waiting for rollout"
kubectl rollout status "deployment/${DEPLOYMENT}" -n "$NAMESPACE" --timeout=300s

echo "✓ Deployed ${IMAGE_NAME}:${TAG}"
