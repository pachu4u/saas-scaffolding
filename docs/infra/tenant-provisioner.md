# Tenant provisioner (`saas-workers` in the k3s cluster)

There are **two separate deployments of `apps/workers`** in this environment.
Mixing them up cost several debugging sessions, so this doc exists to make
the split obvious.

| | docker-compose `workers` | k8s `saas-workers` |
|---|---|---|
| Where | `infra/compose/docker-compose.yml`, `workers` service | k3s namespace `saas-platform`, `Deployment/saas-workers` |
| Manifest | `infra/compose/docker-compose.yml` | `infra/k8s/tenant-provisioner/` (this dir) |
| `TENANT_STACK_DRIVER` | unset → falls back to the legacy "shared instance" driver | `kubernetes` → real per-tenant driver |
| Cluster access | none | `ServiceAccount/saas-workers` bound to `ClusterRole/saas-tenant-provisioner` |
| Job queue | same Redis/BullMQ queue as the k8s deployment | same Redis/BullMQ queue as the compose deployment |

Both processes poll the **same** BullMQ tenant-provisioning queue
(`getTenantStackDriver()` in `apps/workers/src/provisioning/index.ts` picks
the driver at runtime based on `TENANT_STACK_DRIVER`). Only the k8s
deployment is configured to actually create tenant infrastructure — the
compose one is a no-op/shared-path fallback and must never be pointed at
`TENANT_STACK_DRIVER=kubernetes`, since it has no ServiceAccount token and no
RBAC to act on the cluster.

## Why the k8s deployment exists at all

The rest of the platform (web, Postgres, Redis, Keycloak) runs under
docker-compose on this single host — **not** the Helm chart in
`infra/helm/saas-platform/` (that chart targets a fully-Kubernetes topology
that was never adopted here; its `workers:` values block is aspirational and
has no matching templates). k3s is used for exactly one thing: giving each
tenant its own namespace/pod/ingress for their Riogentix instance
(`apps/workers/src/provisioning/kubernetes-driver.ts`). Something has to run
*inside* the cluster with permission to create/delete those tenant
namespaces — that's `saas-workers`.

## RBAC scope

`ClusterRole/saas-tenant-provisioner` (see `rbac.yaml`) can `get/list/create/
patch/update/delete` on `namespaces`, `secrets`, `services` (core), 
`deployments` (apps), and `ingresses` (networking.k8s.io) — cluster-wide,
because provisioning literally means creating a namespace. It cannot touch
RBAC, nodes, CRDs, or any other resource kind. Namespace-scoping this role is
not possible since `namespaces` itself is cluster-scoped.

## History

This deployment was hand-created with raw `kubectl` commands and re-deployed
via repeated `kubectl set image` — no manifest was ever committed, so nobody
new to the incident could tell it existed short of `kubectl get deploy -A`.
That produced 11 stale ReplicaSets and, separately, let it silently break
(dead Redis connection after the Redis port was firewalled) with nothing in
git to diff against. `infra/k8s/tenant-provisioner/` and `deploy.sh` replace
that with a real, reviewable deploy path.

## Deploying

```bash
cd infra/k8s/tenant-provisioner
cp secret.env.example secret.env   # first time only; fill in real values, gitignored
./deploy.sh
```

`deploy.sh` builds `infra/docker/workers.Dockerfile`, tags the image with the
current git short SHA, imports it into k3s's containerd (this host's kubelet
runtime is k3s, not the docker daemon, so a plain `docker build` isn't
visible to it until imported), applies `secret.env` as the
`saas-workers-env` Secret, applies the rest via `kubectl kustomize | kubectl
apply -f -`, and waits for rollout.

These manifests were written to match what was already running live (as of
2026-07-22) — applying them is a no-op against the current cluster state,
confirmed via `kubectl apply --dry-run=server`. They are not yet
Helm-adopted (the live objects have no `meta.helm.sh/release-name`
annotation), so `helm` commands won't see them; that's a separate, deliberate
follow-up if the whole-platform Helm chart is ever actually adopted for this
cluster.
