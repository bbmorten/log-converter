#!/bin/bash

################################################################################
# KinD Cluster Resume Script
#
# Resumes all paused nodes in a KinD cluster, restoring them to their previous
# state. Use this after pausing a cluster with pause-cluster.sh.
#
# Usage:
#   ./resume-cluster.sh [cluster-name]
#
# Default cluster: cilium-labs
################################################################################

set -e

# Configuration
CLUSTER_NAME="${1:-cilium-labs}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_success() {
    echo -e "${CYAN}[✓]${NC} $1"
}

# Main execution
main() {
    echo ""
    echo "========================================="
    echo "  KinD Cluster Resume"
    echo "========================================="
    echo ""

    log_step "Checking for cluster: ${CLUSTER_NAME}"

    # Get all containers for this cluster (including paused ones)
    CONTAINERS=$(docker ps -a --filter "name=${CLUSTER_NAME}" --format "{{.Names}}" 2>/dev/null)

    if [ -z "$CONTAINERS" ]; then
        log_warn "No containers found for cluster: ${CLUSTER_NAME}"
        echo ""
        echo "Available clusters:"
        kind get clusters 2>/dev/null || echo "  No KinD clusters found"
        echo ""
        echo "Usage: $0 [cluster-name]"
        exit 1
    fi

    # Check if any containers are paused
    PAUSED_CONTAINERS=$(docker ps -a --filter "name=${CLUSTER_NAME}" --format "{{.Names}}\t{{.Status}}" | grep "Paused" | cut -f1)

    if [ -z "$PAUSED_CONTAINERS" ]; then
        log_info "Cluster is not paused. Current status:"
        docker ps -a --filter "name=${CLUSTER_NAME}" --format "table {{.Names}}\t{{.Status}}" | sed 's/^/  /'
        echo ""
        log_info "If cluster is stopped, use: docker start \$(docker ps -a --filter \"name=${CLUSTER_NAME}\" --format \"{{.Names}}\")"
        exit 0
    fi

    log_info "Found paused containers:"
    echo "$PAUSED_CONTAINERS" | while read container; do
        echo "  - $container"
    done
    echo ""

    log_step "Resuming cluster nodes..."

    # Unpause each container
    echo "$PAUSED_CONTAINERS" | while read container; do
        log_info "Resuming: $container"
        if docker unpause "$container" > /dev/null 2>&1; then
            log_success "  ✓ $container resumed"
        else
            log_warn "  ✗ Failed to resume $container"
        fi
    done

    echo ""
    log_success "Cluster ${CLUSTER_NAME} has been resumed"
    echo ""

    # Show status
    log_step "Current status:"
    docker ps -a --filter "name=${CLUSTER_NAME}" --format "table {{.Names}}\t{{.Status}}" | sed 's/^/  /'
    echo ""

    # Wait a moment for cluster to stabilize
    log_info "Waiting for cluster to stabilize..."
    sleep 3

    # Test cluster connectivity
    log_step "Testing cluster connectivity..."
    if kubectl get nodes --context "kind-${CLUSTER_NAME}" > /dev/null 2>&1; then
        log_success "Cluster is responding"
        echo ""
        kubectl get nodes --context "kind-${CLUSTER_NAME}"
        echo ""
        log_info "Checking pods..."
        kubectl get pods -A --context "kind-${CLUSTER_NAME}" 2>/dev/null | head -10
    else
        log_warn "Cluster may need a moment to become fully ready"
        log_info "Try: kubectl get nodes --context kind-${CLUSTER_NAME}"
    fi

    echo ""
    log_success "Cluster ${CLUSTER_NAME} is ready to use!"
    echo ""

    # Show helpful next steps
    log_info "Next steps:"
    echo "  - Check all pods: kubectl get pods -A"
    echo "  - Access log-converter: kubectl port-forward -n log-converter svc/log-converter 3000:3000"
    echo "  - Deploy updates: ./deploy.sh"
    echo ""
}

# Run main function
main "$@"
