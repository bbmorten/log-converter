## KinD Cluster Management Scripts

Three convenient scripts to manage your KinD clusters efficiently.

## Scripts Overview

| Script | Purpose | Usage |
|--------|---------|-------|
| `pause-cluster.sh` | Pause cluster to save CPU while keeping state | `./pause-cluster.sh [cluster-name]` |
| `resume-cluster.sh` | Resume a paused cluster | `./resume-cluster.sh [cluster-name]` |
| `cluster-status.sh` | Show comprehensive cluster status | `./cluster-status.sh [cluster-name]` |

All scripts default to the `cilium-labs` cluster if no name is provided.

## Quick Start

### Check Cluster Status

```bash
./cluster-status.sh cilium-labs
```

Shows:
- Docker container status
- Kubernetes nodes
- System pods
- Log Converter application status
- Resource usage
- Recent deployments
- Quick action commands

### Pause Cluster (Save Resources)

```bash
./pause-cluster.sh cilium-labs
```

**What it does**:
- Freezes all cluster nodes in memory
- Stops CPU usage (0% CPU)
- Preserves all state (pods, data, configurations)
- Keeps memory allocated but inactive

**When to use**:
- Taking a lunch break
- Switching to another project
- Need to free up CPU immediately
- Want instant resume later

### Resume Cluster

```bash
./resume-cluster.sh cilium-labs
```

**What it does**:
- Unfreezes all cluster nodes
- Restores full functionality instantly
- Verifies cluster connectivity
- Shows node and pod status

**Resume time**: 3-5 seconds

## Detailed Usage

### Pause Cluster Script

```bash
./pause-cluster.sh cilium-labs
```

**Output**:
```
=========================================
  KinD Cluster Pause
=========================================

[STEP] Checking for cluster: cilium-labs
[INFO] Found containers:
  - cilium-labs-control-plane
  - cilium-labs-worker
  - cilium-labs-worker2

[STEP] Pausing cluster nodes...
[INFO] Pausing: cilium-labs-control-plane
  ✓ cilium-labs-control-plane paused
[INFO] Pausing: cilium-labs-worker
  ✓ cilium-labs-worker paused
[INFO] Pausing: cilium-labs-worker2
  ✓ cilium-labs-worker2 paused

[✓] Cluster cilium-labs has been paused

[STEP] Current status:
  NAMES                       STATUS
  cilium-labs-control-plane   Up 2 hours (Paused)
  cilium-labs-worker          Up 2 hours (Paused)
  cilium-labs-worker2         Up 2 hours (Paused)

[INFO] To resume the cluster, run:
  ./resume-cluster.sh cilium-labs
```

### Resume Cluster Script

```bash
./resume-cluster.sh cilium-labs
```

**Output**:
```
=========================================
  KinD Cluster Resume
=========================================

[STEP] Checking for cluster: cilium-labs
[INFO] Found paused containers:
  - cilium-labs-control-plane
  - cilium-labs-worker
  - cilium-labs-worker2

[STEP] Resuming cluster nodes...
[INFO] Resuming: cilium-labs-control-plane
  ✓ cilium-labs-control-plane resumed
[INFO] Resuming: cilium-labs-worker
  ✓ cilium-labs-worker resumed
[INFO] Resuming: cilium-labs-worker2
  ✓ cilium-labs-worker2 resumed

[✓] Cluster cilium-labs has been resumed

[STEP] Current status:
  NAMES                       STATUS
  cilium-labs-control-plane   Up 2 hours
  cilium-labs-worker          Up 2 hours
  cilium-labs-worker2         Up 2 hours

[INFO] Waiting for cluster to stabilize...
[STEP] Testing cluster connectivity...
[✓] Cluster is responding

NAME                        STATUS   ROLES           AGE   VERSION
cilium-labs-control-plane   Ready    control-plane   18h   v1.34.0
cilium-labs-worker          Ready    <none>          18h   v1.34.0
cilium-labs-worker2         Ready    <none>          18h   v1.34.0

[✓] Cluster cilium-labs is ready to use!

[INFO] Next steps:
  - Check all pods: kubectl get pods -A
  - Access log-converter: kubectl port-forward -n log-converter svc/log-converter 3000:3000
  - Deploy updates: ./deploy.sh
```

### Cluster Status Script

```bash
./cluster-status.sh cilium-labs
```

**Shows**:
1. **Docker Container Status**: Container state, size
2. **Kubernetes Nodes**: Node status, versions, IPs
3. **System Pods**: All kube-system pods
4. **Log Converter Application**:
   - Deployment status
   - Pod status
   - Service configuration
   - PVC status
   - Current version
   - Recent logs
5. **Resource Usage**:
   - Node metrics (if available)
   - Pod metrics (if available)
   - Docker container CPU/memory
6. **Recent Deployments**: Last 5 deployments from history
7. **Quick Actions**: Common commands for cluster management

## Use Cases

### Daily Workflow

#### Morning: Resume Cluster
```bash
./resume-cluster.sh cilium-labs
./cluster-status.sh cilium-labs
```

#### During Work: Check Status
```bash
./cluster-status.sh cilium-labs
```

#### Evening: Pause Cluster
```bash
./pause-cluster.sh cilium-labs
```

### Before Laptop Sleep/Shutdown

```bash
./pause-cluster.sh cilium-labs
```

**Benefits**:
- Saves battery
- Reduces fan noise
- Instant resume on wakeup
- No data loss

### When Switching Projects

```bash
# Pause current cluster
./pause-cluster.sh cilium-labs

# Work on other things...

# Resume when needed
./resume-cluster.sh cilium-labs
```

### Troubleshooting

```bash
# Check what's wrong
./cluster-status.sh cilium-labs

# See pod logs
kubectl logs -n log-converter -l app=log-converter --tail=50

# Restart if needed
./pause-cluster.sh cilium-labs
./resume-cluster.sh cilium-labs
```

## Comparison: Pause vs Stop vs Delete

| Operation | Speed | State Preserved | RAM Used | Use Case |
|-----------|-------|----------------|----------|----------|
| **Pause** | Instant | ✅ Everything | ✅ Yes | Short breaks, switching tasks |
| **Stop** | ~10s | ✅ Disk only | ❌ No | End of day, free RAM |
| **Delete** | ~30s | ❌ Nothing | ❌ No | Clean slate, testing |

### Pause (Recommended for Daily Use)

```bash
./pause-cluster.sh cilium-labs
```

**Pros**:
- ✅ Instant pause/resume (3-5 seconds)
- ✅ Zero data loss
- ✅ No pod restarts
- ✅ Applications stay warm

**Cons**:
- ❌ RAM stays allocated
- ❌ Can't free memory

### Stop (For Freeing RAM)

```bash
# Stop all containers
docker stop $(docker ps --filter "name=cilium-labs" --format "{{.Names}}")

# Start again
docker start $(docker ps -a --filter "name=cilium-labs" --format "{{.Names}}")
```

**Pros**:
- ✅ Frees RAM completely
- ✅ Disk state preserved
- ✅ Faster than delete/recreate

**Cons**:
- ❌ Slower restart (~30s)
- ❌ Pods must restart
- ❌ Applications cold start

### Delete (Complete Reset)

```bash
kind delete cluster --name cilium-labs
```

**Pros**:
- ✅ Complete cleanup
- ✅ Fresh start
- ✅ Frees all resources

**Cons**:
- ❌ Loses all data
- ❌ Must redeploy everything
- ❌ Slowest recovery

## Best Practices

### 1. Use Pause for Short Breaks

```bash
# Going to lunch
./pause-cluster.sh cilium-labs

# Back from lunch
./resume-cluster.sh cilium-labs
```

### 2. Check Status Before Working

```bash
./cluster-status.sh cilium-labs
```

Quickly see if cluster is paused, stopped, or ready.

### 3. Pause Before System Sleep

Add to your shutdown routine:
```bash
./pause-cluster.sh cilium-labs && sleep
```

### 4. Resume and Verify

Always check status after resume:
```bash
./resume-cluster.sh cilium-labs
# Script automatically verifies connectivity
```

### 5. Monitor Resources

```bash
./cluster-status.sh cilium-labs | grep -A 10 "Resource Usage"
```

## Automation

### Zsh/Bash Aliases

Add to `~/.zshrc` or `~/.bashrc`:

```bash
# Cluster management aliases
alias kpause='./pause-cluster.sh cilium-labs'
alias kresume='./resume-cluster.sh cilium-labs'
alias kstatus='./cluster-status.sh cilium-labs'

# Quick check
alias kcheck='kubectl get nodes && kubectl get pods -A'
```

### Auto-resume on Terminal Start

Add to `~/.zshrc`:

```bash
# Check if cluster is paused on terminal start
if docker ps -a --filter "name=cilium-labs-control-plane" --format "{{.Status}}" | grep -q "Paused"; then
    echo "💤 Cluster is paused. Resume with: kresume"
fi
```

## Troubleshooting

### Cluster Won't Resume

```bash
# Check container status
docker ps -a --filter "name=cilium-labs"

# Try unpausing manually
docker unpause cilium-labs-control-plane cilium-labs-worker cilium-labs-worker2

# Or restart containers
docker restart cilium-labs-control-plane cilium-labs-worker cilium-labs-worker2
```

### kubectl Commands Hang After Resume

```bash
# Wait a few seconds for API server to stabilize
sleep 5

# Check API server status
kubectl get --raw /healthz

# Restart kubectl if needed
pkill -9 kubectl
```

### Pods Not Starting After Resume

```bash
# Check pod status
kubectl get pods -A

# Restart problematic pods
kubectl delete pod <pod-name> -n <namespace>

# Or rollout restart deployment
kubectl rollout restart deployment/log-converter -n log-converter
```

### High CPU After Resume

```bash
# Normal for first 30 seconds
# If continues, check status
./cluster-status.sh cilium-labs

# Check what's using CPU
kubectl top nodes
kubectl top pods -A
```

## Integration with Other Scripts

### With Deploy Script

```bash
# Resume, deploy, verify
./resume-cluster.sh cilium-labs && ./deploy.sh && ./cluster-status.sh cilium-labs
```

### With Copy Script

```bash
# Resume, copy files, check status
./resume-cluster.sh cilium-labs && ./copy-to-pod.sh && ./cluster-status.sh cilium-labs
```

### Daily Workflow Script

Create `daily-start.sh`:

```bash
#!/bin/bash
./resume-cluster.sh cilium-labs
./cluster-status.sh cilium-labs
kubectl port-forward -n log-converter svc/log-converter 3000:3000
```

Create `daily-end.sh`:

```bash
#!/bin/bash
pkill -f "port-forward"  # Stop port-forwards
./pause-cluster.sh cilium-labs
echo "Cluster paused. Ready for tomorrow!"
```

## Summary

- ✅ **Pause**: For breaks, switching tasks (instant, keeps everything)
- ✅ **Resume**: Get back to work quickly (3-5 seconds)
- ✅ **Status**: Know exactly what's running
- ✅ **Scripts**: Simple, clear, color-coded output

Use these scripts daily to:
- Save resources when not working
- Resume instantly when needed
- Monitor cluster health easily
- Integrate with deployment workflow

**Quick Reference**:
```bash
./pause-cluster.sh cilium-labs   # Pause for break
./resume-cluster.sh cilium-labs  # Resume to work
./cluster-status.sh cilium-labs  # Check everything
```

For more details, see:
- [DEPLOYMENT.md](DEPLOYMENT.md) - Full deployment guide
- [DEPLOY-GUIDE.md](DEPLOY-GUIDE.md) - Automated deployment
- [QUICK-START.md](QUICK-START.md) - Quick reference
