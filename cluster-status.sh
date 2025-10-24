#!/bin/bash

################################################################################
# KinD Cluster Status Script
#
# Shows detailed status of a KinD cluster including:
# - Docker container status
# - Node status
# - Pod status
# - Resource usage
# - Deployments in log-converter namespace
#
# Usage:
#   ./cluster-status.sh [cluster-name]
#
# Default cluster: cilium-labs
################################################################################

# Configuration
CLUSTER_NAME="${1:-cilium-labs}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Functions
log_section() {
    echo ""
    echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${CYAN}  $1${NC}"
    echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Main execution
main() {
    echo ""
    echo "========================================="
    echo "  KinD Cluster Status: ${CLUSTER_NAME}"
    echo "========================================="

    # Check if cluster exists
    if ! kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
        log_error "Cluster '${CLUSTER_NAME}' not found"
        echo ""
        echo "Available clusters:"
        kind get clusters 2>/dev/null || echo "  No KinD clusters found"
        echo ""
        exit 1
    fi

    # Docker Container Status
    log_section "Docker Container Status"
    docker ps -a --filter "name=${CLUSTER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Size}}"

    # Check if any containers are paused or stopped
    PAUSED=$(docker ps -a --filter "name=${CLUSTER_NAME}" --format "{{.Status}}" | grep -c "Paused" || true)
    STOPPED=$(docker ps -a --filter "name=${CLUSTER_NAME}" --format "{{.Status}}" | grep -c "Exited" || true)

    echo ""
    if [ "$PAUSED" -gt 0 ]; then
        log_warn "$PAUSED container(s) are paused"
        log_info "Resume with: ./resume-cluster.sh ${CLUSTER_NAME}"
    elif [ "$STOPPED" -gt 0 ]; then
        log_warn "$STOPPED container(s) are stopped"
        log_info "Start with: docker start \$(docker ps -a --filter \"name=${CLUSTER_NAME}\" --format \"{{.Names}}\")"
    else
        log_info "All containers are running"
    fi

    # Only proceed with kubectl commands if cluster is running
    if [ "$PAUSED" -eq 0 ] && [ "$STOPPED" -eq 0 ]; then
        # Kubernetes Nodes
        log_section "Kubernetes Nodes"
        if kubectl get nodes --context "kind-${CLUSTER_NAME}" > /dev/null 2>&1; then
            kubectl get nodes --context "kind-${CLUSTER_NAME}" -o wide
        else
            log_warn "Cannot connect to cluster API server"
        fi

        # System Pods
        log_section "System Pods (kube-system)"
        kubectl get pods -n kube-system --context "kind-${CLUSTER_NAME}" 2>/dev/null || log_warn "Cannot fetch system pods"

        # Log Converter Status
        if kubectl get namespace log-converter --context "kind-${CLUSTER_NAME}" > /dev/null 2>&1; then
            log_section "Log Converter Application"

            echo -e "${BOLD}Deployment:${NC}"
            kubectl get deployment -n log-converter --context "kind-${CLUSTER_NAME}" 2>/dev/null || echo "  No deployment found"

            echo ""
            echo -e "${BOLD}Pods:${NC}"
            kubectl get pods -n log-converter --context "kind-${CLUSTER_NAME}" 2>/dev/null || echo "  No pods found"

            echo ""
            echo -e "${BOLD}Service:${NC}"
            kubectl get svc -n log-converter --context "kind-${CLUSTER_NAME}" 2>/dev/null || echo "  No service found"

            echo ""
            echo -e "${BOLD}PVC:${NC}"
            kubectl get pvc -n log-converter --context "kind-${CLUSTER_NAME}" 2>/dev/null || echo "  No PVC found"

            # Get current version if deployment exists
            VERSION=$(kubectl get deployment log-converter -n log-converter --context "kind-${CLUSTER_NAME}" \
                -o jsonpath='{.metadata.annotations.deployment-version}' 2>/dev/null || echo "unknown")
            echo ""
            echo -e "${BOLD}Current Version:${NC} ${VERSION}"

            # Get pod logs if pod exists
            POD_NAME=$(kubectl get pod -n log-converter -l app=log-converter --context "kind-${CLUSTER_NAME}" \
                -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
            if [ -n "$POD_NAME" ]; then
                echo ""
                echo -e "${BOLD}Recent Logs (last 5 lines):${NC}"
                kubectl logs -n log-converter "$POD_NAME" --context "kind-${CLUSTER_NAME}" --tail=5 2>/dev/null | sed 's/^/  /'
            fi
        else
            log_section "Log Converter Application"
            log_info "Namespace 'log-converter' not found"
            log_info "Deploy with: ./deploy.sh"
        fi

        # Resource Usage
        log_section "Resource Usage"
        echo -e "${BOLD}Nodes:${NC}"
        kubectl top nodes --context "kind-${CLUSTER_NAME}" 2>/dev/null || log_warn "Metrics server not available"

        if kubectl get namespace log-converter --context "kind-${CLUSTER_NAME}" > /dev/null 2>&1; then
            echo ""
            echo -e "${BOLD}Log Converter Pods:${NC}"
            kubectl top pods -n log-converter --context "kind-${CLUSTER_NAME}" 2>/dev/null || log_warn "Metrics server not available"
        fi
    fi

    # Docker Resource Usage
    log_section "Docker Resource Usage"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" \
        $(docker ps --filter "name=${CLUSTER_NAME}" --format "{{.Names}}")

    # Deployment History
    if [ -d ".deploy-history" ]; then
        log_section "Recent Deployments"
        if [ "$(ls -A .deploy-history/*.json 2>/dev/null)" ]; then
            echo -e "${BOLD}Last 5 deployments:${NC}"
            ls -t .deploy-history/*.json 2>/dev/null | head -5 | while read file; do
                version=$(basename "$file" .json)
                timestamp=$(jq -r '.timestamp // "unknown"' "$file" 2>/dev/null)
                echo "  - ${version} (${timestamp})"
            done
        else
            log_info "No deployment history found"
        fi
    fi

    # Summary
    log_section "Quick Actions"
    echo "Cluster Management:"
    echo "  - Pause cluster:  ./pause-cluster.sh ${CLUSTER_NAME}"
    echo "  - Resume cluster: ./resume-cluster.sh ${CLUSTER_NAME}"
    echo ""
    echo "Application:"
    echo "  - Deploy/Update:  ./deploy.sh"
    echo "  - Rollback:       ./deploy.sh --rollback"
    echo "  - Copy files:     ./copy-to-pod.sh"
    echo ""
    echo "Access:"
    echo "  - Port-forward:   kubectl port-forward -n log-converter svc/log-converter 3000:3000"
    echo "  - View logs:      kubectl logs -n log-converter -l app=log-converter --follow"
    echo ""
}

# Run main function
main "$@"
