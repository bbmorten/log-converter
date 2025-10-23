# Deployment Automation Guide

## Overview

The `deploy.sh` script automates the deployment and update process for the Log Converter application on KinD Kubernetes clusters. It handles building, versioning, deploying, testing, and rollback operations.

## Features

- 🚀 **Automated Deployment**: One command to build, deploy, and verify
- 🏷️ **Version Management**: Automatic version tagging using git commit SHAs
- 🔄 **Rolling Updates**: Zero-downtime updates with health checks
- ⏮️ **Rollback Support**: Quick rollback to previous versions
- 🧪 **Built-in Testing**: Post-deployment health checks
- 📊 **Deployment History**: Tracks all deployments with metadata
- 🎨 **Dry Run Mode**: Preview changes without applying them
- 🧹 **Cleanup Tools**: Remove old resources and images

## Quick Start

### Initial Deployment

```bash
# Deploy latest code to cilium-labs cluster
./deploy.sh
```

### Update Deployment

```bash
# Build and deploy new version
./deploy.sh

# Or specify a custom version
./deploy.sh --version v1.2.3
```

### Rollback

```bash
# Rollback to previous version
./deploy.sh --rollback

# Rollback to specific version
./deploy.sh --rollback a3f9c21
```

## Usage

```bash
./deploy.sh [OPTIONS]
```

### Options

| Option | Description |
|--------|-------------|
| `--version <version>` | Specify custom version tag (default: git commit SHA) |
| `--skip-build` | Skip Docker build step (use existing image) |
| `--skip-tests` | Skip post-deployment tests |
| `--rollback [version]` | Rollback to previous or specified version |
| `--cleanup` | Remove old images and resources |
| `--dry-run` | Show what would be done without doing it |
| `--help` | Show help message |

## Detailed Usage Examples

### 1. Standard Deployment

Deploy the current code:

```bash
./deploy.sh
```

What it does:
1. Checks prerequisites (Docker, kubectl, kind, cluster)
2. Generates version from git commit SHA
3. Builds Docker image with version tag
4. Loads image into KinD cluster
5. Creates/updates Kubernetes resources
6. Waits for rollout to complete
7. Runs health checks
8. Shows deployment status

### 2. Deploy with Custom Version

```bash
./deploy.sh --version v2.0.0
```

Use this for:
- Release versions (v1.0.0, v2.0.0)
- Feature branches (feature-xyz)
- Environment tags (staging, production)

### 3. Quick Update (Skip Build)

If you already have the image built:

```bash
./deploy.sh --skip-build --version existing-version
```

### 4. Deploy Without Tests

Speed up deployment by skipping tests (not recommended for production):

```bash
./deploy.sh --skip-tests
```

### 5. Dry Run

Preview what would happen without making changes:

```bash
./deploy.sh --dry-run
```

Perfect for:
- Understanding the deployment process
- Verifying commands before execution
- CI/CD pipeline development

### 6. Rollback to Previous Version

Quickly rollback if something goes wrong:

```bash
# Rollback to the version annotated as "previous-version"
./deploy.sh --rollback
```

The script will:
1. Read the previous version from deployment annotations
2. Load the previous Docker image
3. Update the deployment
4. Verify the rollback was successful

### 7. Rollback to Specific Version

```bash
./deploy.sh --rollback a3f9c21
```

Requirements:
- The Docker image for that version must exist locally or in the cluster
- The version must have been previously deployed (recorded in deployment history)

### 8. Cleanup Old Resources

```bash
./deploy.sh --cleanup
```

This will:
- Remove completed init jobs
- List local Docker images
- Show commands to remove old images

## Version Management

### Automatic Versioning

By default, the script uses the git commit SHA as the version:

```bash
# If current commit is a3f9c21d5e8f...
./deploy.sh
# Creates image: log-converter:a3f9c21
```

### Custom Versioning

```bash
# Semantic versioning
./deploy.sh --version v1.2.3

# Date-based versioning
./deploy.sh --version $(date +%Y%m%d-%H%M%S)

# Feature branch
./deploy.sh --version feature-new-ui
```

### Version History

All deployments are recorded in `.deploy-history/`:

```bash
ls -la .deploy-history/
# a3f9c21.json
# v1.0.0.json
# v1.1.0.json
```

Each file contains:
```json
{
  "version": "a3f9c21",
  "timestamp": "2025-10-23T14:30:00Z",
  "image": "log-converter:a3f9c21",
  "cluster": "cilium-labs",
  "namespace": "log-converter"
}
```

## Deployment Workflow

### What Happens During Deployment

```
1. Prerequisites Check
   ├─ Docker installed?
   ├─ kubectl installed?
   ├─ kind installed?
   ├─ Cluster exists?
   └─ Can connect to cluster?

2. Version Generation
   └─ Get git commit SHA or use provided version

3. Build Phase
   ├─ Build Docker image with version tag
   └─ Tag as both :version and :latest

4. Load to Cluster
   └─ Load image into all KinD nodes

5. Deploy/Update
   ├─ Create namespace (if needed)
   ├─ Create PVC (if needed)
   ├─ Run init job (if PVC is new)
   ├─ Create/update deployment
   │   ├─ Patch with new image version
   │   └─ Add version annotations
   └─ Create service (if needed)

6. Rollout Wait
   ├─ Monitor deployment progress
   ├─ Wait for pods to be Ready
   └─ Timeout after 5 minutes

7. Post-Deployment Tests
   ├─ Verify pod is running
   ├─ Test API endpoint
   └─ Validate responses

8. Save History
   └─ Write deployment metadata to .deploy-history/

9. Show Status
   ├─ Display all resources
   ├─ Show current version
   └─ Provide access instructions
```

## Annotations

The script adds these annotations to track versions:

```yaml
metadata:
  annotations:
    deployment-version: "a3f9c21"
    previous-version: "v1.0.0"
    deployment-timestamp: "2025-10-23T14:30:00Z"
```

View annotations:
```bash
kubectl get deployment log-converter -n log-converter -o yaml | grep -A 3 annotations
```

## Rollback Strategy

### Automatic Rollback

```bash
./deploy.sh --rollback
```

Finds the `previous-version` annotation and rolls back to it.

### Manual Rollback

```bash
./deploy.sh --rollback v1.0.0
```

Rolls back to a specific version.

### Kubernetes Native Rollback

You can also use kubectl:

```bash
# View rollout history
kubectl rollout history deployment/log-converter -n log-converter

# Rollback to previous
kubectl rollout undo deployment/log-converter -n log-converter

# Rollback to specific revision
kubectl rollout undo deployment/log-converter -n log-converter --to-revision=2
```

## Troubleshooting

### Build Fails

```bash
# Check Docker is running
docker ps

# Try building manually
docker build -t log-converter:test .
```

### Image Load Fails

```bash
# Verify cluster exists
kind get clusters

# Check cluster name
kind get clusters | grep cilium-labs

# Try loading manually
kind load docker-image log-converter:latest --name cilium-labs
```

### Deployment Fails

```bash
# Check pod status
kubectl get pods -n log-converter

# View pod logs
kubectl logs -n log-converter -l app=log-converter

# Describe pod for events
kubectl describe pod -n log-converter -l app=log-converter

# Check deployment events
kubectl get events -n log-converter --sort-by='.lastTimestamp'
```

### Tests Fail

```bash
# Check if pod is actually running
kubectl get pods -n log-converter

# Manually test API
POD_NAME=$(kubectl get pod -n log-converter -l app=log-converter -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n log-converter $POD_NAME -- wget -O- http://localhost:3000/api/files

# Skip tests if needed
./deploy.sh --skip-tests
```

### Rollback Fails

```bash
# Check deployment history
kubectl rollout history deployment/log-converter -n log-converter

# Check if old image exists
docker images log-converter

# List deployment history
ls -la .deploy-history/

# Use specific version
./deploy.sh --rollback <version-from-history>
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to KinD

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup KinD
        uses: helm/kind-action@v1.5.0
        with:
          cluster_name: cilium-labs

      - name: Deploy
        run: |
          chmod +x deploy.sh
          ./deploy.sh --version ${GITHUB_SHA::7}
```

### GitLab CI Example

```yaml
deploy:
  stage: deploy
  script:
    - chmod +x deploy.sh
    - ./deploy.sh --version $CI_COMMIT_SHORT_SHA
  only:
    - main
```

### Manual Release Process

```bash
# 1. Tag release
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0

# 2. Deploy with release tag
./deploy.sh --version v1.2.0

# 3. Verify deployment
kubectl get deployment -n log-converter -o yaml | grep deployment-version

# 4. Test application
kubectl port-forward -n log-converter svc/log-converter 3000:3000
curl http://localhost:3000/api/files
```

## Best Practices

### 1. Always Test Before Deploying

```bash
# Run dry-run first
./deploy.sh --dry-run

# Then deploy
./deploy.sh
```

### 2. Use Semantic Versioning for Releases

```bash
# Development: use git SHA
./deploy.sh

# Production: use semantic version
./deploy.sh --version v1.2.3
```

### 3. Keep Deployment History

Don't delete `.deploy-history/` files - they're useful for:
- Auditing deployments
- Troubleshooting issues
- Rolling back

### 4. Monitor Deployments

```bash
# Watch deployment in real-time
kubectl get pods -n log-converter -w

# Follow logs
kubectl logs -f -n log-converter -l app=log-converter
```

### 5. Regular Cleanup

```bash
# Monthly cleanup
./deploy.sh --cleanup

# Remove images older than 30 days
docker image prune -a --filter "until=720h"
```

## Advanced Usage

### Custom Cluster Name

Edit the script variables:

```bash
CLUSTER_NAME="my-cluster"
NAMESPACE="my-namespace"
```

### Pre-Deployment Hooks

Add custom checks before deployment:

```bash
# Add after check_prerequisites() function
check_custom_requirements() {
    # Your custom checks here
    log_info "Running custom checks..."
}

# Call in main()
main() {
    check_prerequisites
    check_custom_requirements  # Add this line
    # ... rest of main
}
```

### Post-Deployment Actions

Add custom actions after deployment:

```bash
# Add after run_tests() in main()
run_custom_actions() {
    log_info "Running custom actions..."
    # Warm up cache
    # Send notifications
    # Update load balancer
}
```

## Comparison with kubectl apply

### Using deploy.sh (Recommended)

✅ Automatic version management
✅ Built-in rollback
✅ Health checks
✅ Deployment history
✅ Dry-run mode
✅ Cleanup tools

```bash
./deploy.sh
```

### Using kubectl directly (Manual)

```bash
docker build -t log-converter:$(git rev-parse --short HEAD) .
kind load docker-image log-converter:$(git rev-parse --short HEAD) --name cilium-labs
kubectl set image deployment/log-converter log-converter=log-converter:$(git rev-parse --short HEAD) -n log-converter
kubectl rollout status deployment/log-converter -n log-converter
```

❌ More commands
❌ No version tracking
❌ Manual rollback
❌ No built-in tests

## Summary

The `deploy.sh` script provides a production-ready deployment solution with:

- **Simple Usage**: One command to deploy everything
- **Safety**: Dry-run, rollback, and health checks
- **Traceability**: Version tracking and deployment history
- **Flexibility**: Supports various deployment scenarios
- **Reliability**: Automatic health checks and error handling

For most use cases, simply run:

```bash
./deploy.sh
```

For questions or issues, see [DEPLOYMENT.md](DEPLOYMENT.md) or [QUICK-START.md](QUICK-START.md).
