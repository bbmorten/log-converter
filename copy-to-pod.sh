#!/bin/bash

# Script to copy files from local logging directory to the Kubernetes pod
# Usage: ./copy-to-pod.sh [file_or_directory]

set -e

NAMESPACE="log-converter"
APP_LABEL="app=log-converter"
TARGET_PATH="/app/logging/"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored messages
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get the pod name
log_info "Finding pod in namespace '$NAMESPACE'..."
POD_NAME=$(kubectl get pod -n "$NAMESPACE" -l "$APP_LABEL" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

if [ -z "$POD_NAME" ]; then
    log_error "No pod found with label '$APP_LABEL' in namespace '$NAMESPACE'"
    exit 1
fi

log_info "Found pod: $POD_NAME"

# Check if pod is ready
POD_STATUS=$(kubectl get pod -n "$NAMESPACE" "$POD_NAME" -o jsonpath='{.status.phase}')
if [ "$POD_STATUS" != "Running" ]; then
    log_error "Pod is not running (status: $POD_STATUS)"
    exit 1
fi

# Determine what to copy
if [ -z "$1" ]; then
    # No argument provided, copy entire logging directory
    SOURCE="./logging/"
    log_info "Copying entire logging directory..."
else
    SOURCE="$1"
    if [ ! -e "$SOURCE" ]; then
        log_error "Source '$SOURCE' does not exist"
        exit 1
    fi
    log_info "Copying: $SOURCE"
fi

# Perform the copy
log_info "Copying to pod: $NAMESPACE/$POD_NAME:$TARGET_PATH"
if kubectl cp "$SOURCE" "$NAMESPACE/$POD_NAME:$TARGET_PATH" 2>&1; then
    log_info "Copy completed successfully!"
else
    log_error "Copy failed"
    exit 1
fi

# List files in the target directory
log_info "Files in pod's logging directory:"
echo "----------------------------------------"
kubectl exec -n "$NAMESPACE" "$POD_NAME" -- ls -lah "$TARGET_PATH"
echo "----------------------------------------"

# Show available space
DISK_USAGE=$(kubectl exec -n "$NAMESPACE" "$POD_NAME" -- df -h "$TARGET_PATH" 2>/dev/null | tail -1)
log_info "Disk usage: $DISK_USAGE"

# Verify files are accessible via API
log_info "Testing API endpoint..."
if kubectl exec -n "$NAMESPACE" "$POD_NAME" -- wget -q -O- http://localhost:3000/api/files 2>/dev/null | grep -q "files"; then
    log_info "API is responding correctly"

    # Show file count
    FILE_COUNT=$(kubectl exec -n "$NAMESPACE" "$POD_NAME" -- wget -q -O- http://localhost:3000/api/files 2>/dev/null | grep -o '"count":[0-9]*' | grep -o '[0-9]*')
    log_info "Total files visible to API: $FILE_COUNT"
else
    log_warn "Could not verify API response"
fi

echo ""
log_info "Done! Access the application at: http://localhost:3000"
log_info "Run this command to port-forward: kubectl port-forward -n $NAMESPACE svc/log-converter 3000:3000"
