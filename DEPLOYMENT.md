# Log Converter - Kubernetes Deployment Guide

## Deployment Overview

This application has been successfully deployed to the `cilium-labs` KinD cluster with the following resources:

### Kubernetes Resources

- **Namespace**: `log-converter`
- **Deployment**: `log-converter` (1 replica)
- **Service**: `log-converter` (NodePort on port 30300)
- **PersistentVolumeClaim**: `log-converter-storage` (5Gi, using local-path storage)
- **Init Job**: `log-converter-init` (creates sample log files)

### Architecture

```
┌─────────────────────────────────────────┐
│   KinD Cluster: cilium-labs             │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Namespace: log-converter         │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  Deployment: log-converter  │  │  │
│  │  │  - Next.js App              │  │  │
│  │  │  - Port: 3000               │  │  │
│  │  │  - Image: log-converter     │  │  │
│  │  │  - Resources: 256Mi-512Mi   │  │  │
│  │  └─────────────────────────────┘  │  │
│  │            ↓                       │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  PVC: log-converter-storage │  │  │
│  │  │  - 5Gi local-path storage   │  │  │
│  │  │  - Mounted at: /app/logging │  │  │
│  │  └─────────────────────────────┘  │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  Service: NodePort          │  │  │
│  │  │  - Port: 3000 → 30300       │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Accessing the Application

### Option 1: Port Forward (Recommended for Development)

```bash
kubectl port-forward -n log-converter svc/log-converter 3000:3000
```

Then open your browser to: `http://localhost:3000`

### Option 2: NodePort Access

For KinD clusters, you can access the NodePort service through the Docker container's IP:

```bash
# Get the control plane container IP
CONTROL_PLANE_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' cilium-labs-control-plane)

# Access the application
echo "Application available at: http://${CONTROL_PLANE_IP}:30300"

# Or use curl to test
curl http://${CONTROL_PLANE_IP}:30300
```

### Option 3: kubectl proxy

```bash
kubectl proxy --port=8001
```

Then access via: `http://localhost:8001/api/v1/namespaces/log-converter/services/log-converter:3000/proxy/`

## Deployment Commands

### Initial Deployment

```bash
# Build the Docker image
docker build -t log-converter:latest .

# Load image into KinD cluster
kind load docker-image log-converter:latest --name cilium-labs

# Deploy to Kubernetes
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/init-job.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

### Verify Deployment

```bash
# Check all resources
kubectl get all -n log-converter

# Check persistent volume claim
kubectl get pvc -n log-converter

# Check pod logs
kubectl logs -n log-converter deployment/log-converter

# Check init job logs (to verify sample files were created)
kubectl logs -n log-converter job/log-converter-init
```

### Update Deployment

When you make changes to the application:

```bash
# Rebuild the Docker image
docker build -t log-converter:latest .

# Reload image into KinD cluster
kind load docker-image log-converter:latest --name cilium-labs

# Restart the deployment to use the new image
kubectl rollout restart deployment/log-converter -n log-converter

# Watch the rollout status
kubectl rollout status deployment/log-converter -n log-converter
```

## Managing Log Files

### Add Custom Log Files

#### Option 1: Use the Helper Script (Recommended)

We've provided a convenient script to copy files to the pod:

```bash
# Make it executable (first time only)
chmod +x copy-to-pod.sh

# Copy entire logging directory
./copy-to-pod.sh

# Copy a specific file
./copy-to-pod.sh ./logging/cilium-installation-v2.cast

# Copy a specific directory
./copy-to-pod.sh ./logging/
```

The script will:

- Automatically find the running pod
- Copy the files
- Verify the copy was successful
- Show the files in the pod
- Test the API endpoint

#### Option 2: Manual Copy with kubectl cp

```bash
# Get the pod name dynamically
POD_NAME=$(kubectl get pod -n log-converter -l app=log-converter -o jsonpath='{.items[0].metadata.name}')

# Copy entire logging directory
kubectl cp ./logging/ log-converter/$POD_NAME:/app/logging/ -n log-converter

# Copy a specific file
kubectl cp ./logging/yourfile.log log-converter/$POD_NAME:/app/logging/ -n log-converter

# Copy multiple files with a loop
for file in ./logging/*.{log,cast}; do
  [ -f "$file" ] && kubectl cp "$file" log-converter/$POD_NAME:/app/logging/ -n log-converter
done
```

#### Option 3: Exec into Pod

```bash
# Exec into the pod and create files manually
kubectl exec -it -n log-converter deployment/log-converter -- sh
cd /app/logging
# Create or edit files as needed
```

### View Existing Log Files

```bash
# List files in the logging directory
kubectl exec -n log-converter deployment/log-converter -- ls -la /app/logging
```

### Add Cast Files

To add asciinema recordings:

```bash
cd logging
# Copy a .cast file into the pod
kubectl cp /path/to/recording.cast log-converter/<pod-name>:/app/logging/recording.cast -n log-converter
kubectl cp ./cilium-installation-v2.cast log-converter/log-converter-7c856bc9df-mqprx:/app/logging/ -n log-converter
kubectl cp ./ log-converter/log-converter-7c856bc9df-mqprx:/app/logging/ -n log-converter
```

````bash
cd logging
# Get the pod name
POD_NAME=$(kubectl get pod -n log-converter -l app=log-converter -o jsonpath='{.items[0].metadata.name}')
kubectl cp ./ log-converter/$POD_NAME:/app/logging/ -n log-converter
```Ï


## Storage Behavior

The application uses a PersistentVolumeClaim with the `local-path` StorageClass (similar to the demo pods in the README-CILIUM-LABS-KIND.md guide):

- **Storage Type**: Local path provisioner (pre-installed in KinD)
- **Access Mode**: ReadWriteOnce (single pod can mount)
- **Size**: 5Gi
- **Persistence**: Data persists across pod restarts
- **Location on Node**: `/var/local-path-provisioner` (mapped to host directory)

### Data Persistence

- Log files are stored in the PVC and persist even if the pod is deleted
- The init job creates sample log files only if they don't already exist
- To reset to default sample files, delete the PVC and redeploy

```bash
# Delete PVC (this will delete all stored files)
kubectl delete pvc log-converter-storage -n log-converter

# Redeploy (will create new PVC and run init job again)
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/init-job.yaml
kubectl rollout restart deployment/log-converter -n log-converter
````

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl get pods -n log-converter

# Check pod events
kubectl describe pod -n log-converter -l app=log-converter

# Check logs
kubectl logs -n log-converter deployment/log-converter
```

### Image Pull Issues

Since we're using `imagePullPolicy: Never`, ensure the image is loaded into all KinD nodes:

```bash
# Verify image is present on nodes
docker exec cilium-labs-control-plane crictl images | grep log-converter
docker exec cilium-labs-worker crictl images | grep log-converter
docker exec cilium-labs-worker2 crictl images | grep log-converter
```

### Storage Issues

```bash
# Check PVC status
kubectl get pvc -n log-converter
kubectl describe pvc log-converter-storage -n log-converter

# Check if local-path provisioner is running
kubectl get pods -n local-path-storage
```

### Application Not Accessible

```bash
# Check service endpoints
kubectl get endpoints -n log-converter

# Test from within the cluster
kubectl run -it --rm debug --image=busybox --restart=Never -n log-converter -- wget -O- http://log-converter:3000
```

## Resource Configuration

### Current Resource Limits

The deployment is configured with:

```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "200m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### Health Checks

- **Liveness Probe**: HTTP GET on port 3000, path `/`

  - Initial delay: 30s
  - Period: 10s

- **Readiness Probe**: HTTP GET on port 3000, path `/`
  - Initial delay: 10s
  - Period: 5s

## Cleanup

To remove the entire deployment:

```bash
# Delete all resources
kubectl delete namespace log-converter

# Note: PVC data will be deleted with the namespace
```

## Next Steps

1. **Access the Application**: Use port-forward to access the UI
2. **Upload Your Logs**: Copy your actual log files to the persistent storage
3. **Add Cast Recordings**: Upload asciinema recordings for playback
4. **Scale if Needed**: Adjust replica count in deployment.yaml (note: storage is RWO)
5. **Monitor**: Watch logs and resource usage

## Configuration Files

All Kubernetes manifests are located in the `k8s/` directory:

- `namespace.yaml` - Creates the log-converter namespace
- `pvc.yaml` - PersistentVolumeClaim for log storage
- `init-job.yaml` - Job to initialize sample log files
- `deployment.yaml` - Main application deployment
- `service.yaml` - NodePort service configuration

## Application Features

The deployed application provides:

- ✅ Interactive log file viewer with filtering and search
- ✅ Asciinema terminal recording playback
- ✅ Cast file to Markdown conversion
- ✅ Multiple log format support (standard, access logs, unstructured)
- ✅ Real-time file selection interface
- ✅ Responsive design optimized for log analysis

For more details about the application features, see [CLAUDE.md](CLAUDE.md).
