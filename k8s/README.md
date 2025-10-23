# Kubernetes Manifests

This directory contains all Kubernetes manifests for deploying the Log Converter application to a Kubernetes cluster.

## Files

- **namespace.yaml** - Creates the `log-converter` namespace
- **pvc.yaml** - PersistentVolumeClaim for log file storage (5Gi)
- **init-job.yaml** - Kubernetes Job that initializes sample log files
- **deployment.yaml** - Application deployment with 1 replica
- **service.yaml** - NodePort service exposing the application on port 30300

## Quick Deployment

```bash
# 1. Build and load the Docker image
docker build -t log-converter:latest ..
kind load docker-image log-converter:latest --name cilium-labs

# 2. Deploy all resources
kubectl apply -f namespace.yaml
kubectl apply -f pvc.yaml
kubectl apply -f init-job.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

# 3. Wait for deployment to be ready
kubectl wait --for=condition=Ready pod -l app=log-converter -n log-converter --timeout=120s

# 4. Access the application
kubectl port-forward -n log-converter svc/log-converter 3000:3000
# Then open http://localhost:3000 in your browser
```

## Resource Details

### Namespace
- Name: `log-converter`
- Isolates all application resources

### PersistentVolumeClaim
- Name: `log-converter-storage`
- Size: 5Gi
- StorageClass: `local-path` (KinD default)
- Access Mode: ReadWriteOnce
- Mount Path: `/app/logging`

### Init Job
- Name: `log-converter-init`
- Purpose: Creates sample log files (app.log, system.log, access.log)
- Runs once on initial deployment
- Shared volume with main deployment

### Deployment
- Name: `log-converter`
- Replicas: 1
- Image: `log-converter:latest`
- ImagePullPolicy: Never (for KinD)
- Resources:
  - Requests: 256Mi memory, 200m CPU
  - Limits: 512Mi memory, 500m CPU
- Probes:
  - Liveness: HTTP GET / (30s initial delay)
  - Readiness: HTTP GET / (10s initial delay)

### Service
- Name: `log-converter`
- Type: NodePort
- Port: 3000 (container) → 30300 (node)
- Selector: `app=log-converter`

## Updating the Deployment

```bash
# Rebuild and reload image
docker build -t log-converter:latest ..
kind load docker-image log-converter:latest --name cilium-labs

# Restart deployment
kubectl rollout restart deployment/log-converter -n log-converter
kubectl rollout status deployment/log-converter -n log-converter
```

## Scaling

To increase replicas (note: storage is RWO, so additional pods won't have write access):

```bash
kubectl scale deployment/log-converter --replicas=3 -n log-converter
```

For true horizontal scaling, you would need to:
1. Change storage to ReadWriteMany (RWX)
2. Use a different storage class that supports RWX
3. Or use a shared storage solution like NFS

## Cleanup

```bash
# Delete all resources
kubectl delete namespace log-converter
```

## Customization

### Change Resource Limits

Edit [deployment.yaml](deployment.yaml) and modify the `resources` section:

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

### Change Storage Size

Edit [pvc.yaml](pvc.yaml):

```yaml
resources:
  requests:
    storage: 10Gi
```

### Use Different Service Type

Edit [service.yaml](service.yaml) to use LoadBalancer or ClusterIP instead of NodePort:

```yaml
spec:
  type: LoadBalancer
  # Remove nodePort field
```

## Troubleshooting

### Check Pod Status
```bash
kubectl get pods -n log-converter
kubectl describe pod -l app=log-converter -n log-converter
kubectl logs -n log-converter deployment/log-converter
```

### Check Storage
```bash
kubectl get pvc -n log-converter
kubectl describe pvc log-converter-storage -n log-converter
```

### Check Service
```bash
kubectl get svc -n log-converter
kubectl get endpoints -n log-converter
```

### Test from Inside Cluster
```bash
kubectl run -it --rm debug --image=busybox --restart=Never -n log-converter -- wget -O- http://log-converter:3000/api/files
```

For more detailed information, see [../DEPLOYMENT.md](../DEPLOYMENT.md).
