#!/bin/bash

################################################################################
# KinD Cluster Pause Script
#
# Pauses all nodes in a KinD cluster to save CPU resources while maintaining
# state in memory. This is useful when you need to temporarily stop work but
# want to resume quickly without losing any state.
#
# Usage:
#   ./pause-cluster.sh [cluster-name]
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
    echo "  KinD Cluster Pause"
    echo "========================================="
    echo ""

    log_step "Checking for cluster: ${CLUSTER_NAME}"

    # Get all running containers for this cluster
    CONTAINERS=$(docker ps --filter "name=${CLUSTER_NAME}" --format "{{.Names}}" 2>/dev/null)

    if [ -z "$CONTAINERS" ]; then
        log_warn "No running containers found for cluster: ${CLUSTER_NAME}"
        echo ""
        echo "Available clusters:"
        kind get clusters 2>/dev/null || echo "  No KinD clusters found"
        echo ""
        echo "Usage: $0 [cluster-name]"
        exit 1
    fi

    log_info "Found containers:"
    echo "$CONTAINERS" | while read container; do
        echo "  - $container"
    done
    echo ""

    log_step "Pausing cluster nodes..."

    # Pause each container
    echo "$CONTAINERS" | while read container; do
        log_info "Pausing: $container"
        if docker pause "$container" > /dev/null 2>&1; then
            log_success "  ✓ $container paused"
        else
            log_warn "  ✗ Failed to pause $container"
        fi
    done

    echo ""
    log_success "Cluster ${CLUSTER_NAME} has been paused"
    echo ""

    # Show status
    log_step "Current status:"
    docker ps -a --filter "name=${CLUSTER_NAME}" --format "table {{.Names}}\t{{.Status}}" | sed 's/^/  /'
    echo ""

    # Show resource usage before pause
    log_info "Resources saved:"
    echo "  - CPU: Cluster nodes are now frozen (0% CPU usage)"
    echo "  - RAM: Memory is preserved but not actively used"
    echo "  - State: All pods and data remain in memory"
    echo ""

    log_info "To resume the cluster, run:"
    echo "  ./resume-cluster.sh ${CLUSTER_NAME}"
    echo ""
}

# Run main function
main "$@"
