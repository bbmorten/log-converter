# Log Converter - Quick Start Guide

## TL;DR - Get Started in 3 Steps

```bash
# 1. Copy your log files to the pod
./copy-to-pod.sh

# 2. Access the application
kubectl port-forward -n log-converter svc/log-converter 3000:3000

# 3. Open in browser
open http://localhost:3000
```

## Common Commands

### Copy Files to Pod

```bash
# Copy entire logging directory
./copy-to-pod.sh

# Copy specific file
./copy-to-pod.sh ./logging/cilium-installation-v2.cast
```

### Access the Application

```bash
# Port forward (keeps running until Ctrl+C)
kubectl port-forward -n log-converter svc/log-converter 3000:3000
```

Then open: **http://localhost:3000**

### Check Application Status

```bash
# Quick status check
kubectl get all -n log-converter

# Check logs
kubectl logs -n log-converter deployment/log-converter --tail=50 --follow

# List files in pod
kubectl exec -n log-converter deployment/log-converter -- ls -lah /app/logging
```

### Update Application

```bash
# After code changes
docker build -t log-converter:latest .
kind load docker-image log-converter:latest --name cilium-labs
kubectl rollout restart deployment/log-converter -n log-converter
```

### Troubleshooting

```bash
# Get pod name
kubectl get pods -n log-converter

# Check pod details
kubectl describe pod -n log-converter -l app=log-converter

# Check logs
kubectl logs -n log-converter deployment/log-converter

# Exec into pod
kubectl exec -it -n log-converter deployment/log-converter -- sh

# Test API from inside pod
kubectl exec -n log-converter deployment/log-converter -- wget -O- http://localhost:3000/api/files
```

## File Operations

### Add Files

```bash
# Using helper script
./copy-to-pod.sh ./logging/myfile.log

# Manual copy
POD_NAME=$(kubectl get pod -n log-converter -l app=log-converter -o jsonpath='{.items[0].metadata.name}')
kubectl cp ./logging/myfile.log log-converter/$POD_NAME:/app/logging/ -n log-converter
```

### View Files

```bash
# List files
kubectl exec -n log-converter deployment/log-converter -- ls -lah /app/logging

# View file content
kubectl exec -n log-converter deployment/log-converter -- cat /app/logging/app.log

# Check disk usage
kubectl exec -n log-converter deployment/log-converter -- df -h /app/logging
```

### Remove Files

```bash
# Delete a file
kubectl exec -n log-converter deployment/log-converter -- rm /app/logging/oldfile.log

# Clear all files (keeps directory)
kubectl exec -n log-converter deployment/log-converter -- sh -c "rm -f /app/logging/*"
```

## URLs and Endpoints

- **Web UI**: http://localhost:3000 (with port-forward)
- **Files API**: http://localhost:3000/api/files
- **Logs API**: http://localhost:3000/api/logs
- **Cast API**: http://localhost:3000/api/cast
- **Cast to Markdown**: http://localhost:3000/api/cast-to-markdown

## Supported File Types

- **`.log`** - Log files (standard, access logs, unstructured)
- **`.cast`** - Asciinema terminal recordings

## Resource Locations

- **Namespace**: `log-converter`
- **Deployment**: `log-converter`
- **Service**: `log-converter` (NodePort 30300)
- **Storage**: `log-converter-storage` (5Gi PVC)
- **Mount Path**: `/app/logging` (inside pod)

## Complete Deployment

If you need to deploy from scratch:

```bash
# Build and load image
docker build -t log-converter:latest .
kind load docker-image log-converter:latest --name cilium-labs

# Deploy
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/init-job.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# Wait for ready
kubectl wait --for=condition=Ready pod -l app=log-converter -n log-converter --timeout=120s
```

## Complete Cleanup

```bash
# Delete everything
kubectl delete namespace log-converter

# This removes:
# - Deployment
# - Service
# - PVC and all stored files
# - Init job
# - Namespace
```

## Need More Help?

- Full deployment guide: [DEPLOYMENT.md](DEPLOYMENT.md)
- Application features: [CLAUDE.md](CLAUDE.md)
- Kubernetes manifests: [k8s/README.md](k8s/README.md)
- Cilium Labs setup: [README-CILIUM-LABS-KIND.md](README-CILIUM-LABS-KIND.md)

## Pro Tips

1. **Use the helper script** - `./copy-to-pod.sh` handles pod discovery and verification automatically
2. **Keep port-forward running** - Open a dedicated terminal for port-forwarding
3. **Files persist** - Data in PVC survives pod restarts
4. **Monitor logs** - Use `--follow` flag to watch logs in real-time
5. **Test API directly** - Use curl or wget to test endpoints before using the UI

## Example Workflow

```bash
# 1. Start port-forward in one terminal
kubectl port-forward -n log-converter svc/log-converter 3000:3000

# 2. In another terminal, copy your files
./copy-to-pod.sh ./logging/

# 3. Open browser
open http://localhost:3000

# 4. Select files and explore!
```

🎉 **You're all set!** Access http://localhost:3000 after port-forwarding to start viewing your logs.
