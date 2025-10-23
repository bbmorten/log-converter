#!/bin/bash

################################################################################
# Log Converter Deployment Script
#
# Automates deployment and updates to KinD cilium-labs cluster
#
# Usage:
#   ./deploy.sh [OPTIONS]
#
# Options:
#   --version <version>  Specify version tag (default: git commit SHA)
#   --skip-build         Skip Docker build step
#   --skip-tests         Skip pre-deployment tests
#   --rollback [version] Rollback to previous or specified version
#   --cleanup            Remove old images and resources
#   --dry-run            Show what would be done without doing it
#   --help               Show this help message
#
################################################################################

set -e  # Exit on error

# Configuration
CLUSTER_NAME="cilium-labs"
NAMESPACE="log-converter"
APP_NAME="log-converter"
IMAGE_NAME="log-converter"
DEPLOYMENT_NAME="log-converter"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse command line arguments
VERSION=""
SKIP_BUILD=false
SKIP_TESTS=false
ROLLBACK=false
ROLLBACK_VERSION=""
CLEANUP=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --version)
            VERSION="$2"
            shift 2
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --rollback)
            ROLLBACK=true
            if [[ -n "$2" && ! "$2" =~ ^-- ]]; then
                ROLLBACK_VERSION="$2"
                shift 2
            else
                shift
            fi
            ;;
        --cleanup)
            CLEANUP=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            grep "^#" "$0" | grep -v "#!/bin/bash" | sed 's/^# //; s/^#//'
            exit 0
            ;;
        *)
            echo -e "${RED}Error: Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

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

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
    echo -e "${CYAN}[✓]${NC} $1"
}

run_command() {
    local cmd="$1"
    local description="$2"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would execute: $cmd"
        return 0
    fi

    if [ -n "$description" ]; then
        log_info "$description"
    fi

    if eval "$cmd"; then
        return 0
    else
        log_error "Command failed: $cmd"
        return 1
    fi
}

check_prerequisites() {
    log_step "Checking prerequisites..."

    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "docker is not installed"
        exit 1
    fi

    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi

    # Check if kind is installed
    if ! command -v kind &> /dev/null; then
        log_error "kind is not installed"
        exit 1
    fi

    # Check if cluster exists
    if ! kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
        log_error "KinD cluster '${CLUSTER_NAME}' not found"
        exit 1
    fi

    # Check if kubectl can connect
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    log_success "All prerequisites satisfied"
}

get_version() {
    if [ -n "$VERSION" ]; then
        echo "$VERSION"
    else
        # Use git commit SHA as version
        if git rev-parse --git-dir > /dev/null 2>&1; then
            git rev-parse --short HEAD
        else
            date +%Y%m%d-%H%M%S
        fi
    fi
}

get_current_deployment_version() {
    kubectl get deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" \
        -o jsonpath='{.metadata.annotations.deployment-version}' 2>/dev/null || echo "unknown"
}

save_deployment_info() {
    local version=$1
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Save deployment history
    mkdir -p .deploy-history
    cat > ".deploy-history/${version}.json" <<EOF
{
  "version": "${version}",
  "timestamp": "${timestamp}",
  "image": "${IMAGE_NAME}:${version}",
  "cluster": "${CLUSTER_NAME}",
  "namespace": "${NAMESPACE}"
}
EOF

    log_info "Deployment info saved to .deploy-history/${version}.json"
}

build_image() {
    local version=$1
    log_step "Building Docker image: ${IMAGE_NAME}:${version}"

    if [ "$SKIP_BUILD" = true ]; then
        log_warn "Skipping build (--skip-build specified)"
        return 0
    fi

    run_command "docker build -t ${IMAGE_NAME}:${version} -t ${IMAGE_NAME}:latest ." \
                "Building Docker image..."

    log_success "Image built: ${IMAGE_NAME}:${version}"
}

load_image_to_kind() {
    local version=$1
    log_step "Loading image to KinD cluster: ${CLUSTER_NAME}"

    run_command "kind load docker-image ${IMAGE_NAME}:${version} --name ${CLUSTER_NAME}" \
                "Loading image into cluster..."

    log_success "Image loaded to cluster"
}

deploy_or_update() {
    local version=$1
    log_step "Deploying version: ${version}"

    # Check if namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_info "Creating namespace: ${NAMESPACE}"
        run_command "kubectl apply -f k8s/namespace.yaml" "Creating namespace..."
    fi

    # Check if PVC exists
    if ! kubectl get pvc "$APP_NAME-storage" -n "$NAMESPACE" &> /dev/null; then
        log_info "Creating PersistentVolumeClaim"
        run_command "kubectl apply -f k8s/pvc.yaml" "Creating PVC..."

        # Run init job if PVC is new
        log_info "Running init job to create sample files"
        run_command "kubectl delete job ${APP_NAME}-init -n ${NAMESPACE} --ignore-not-found=true" \
                    "Cleaning up old init job..."
        run_command "kubectl apply -f k8s/init-job.yaml" "Creating init job..."

        if [ "$DRY_RUN" = false ]; then
            log_info "Waiting for init job to complete..."
            kubectl wait --for=condition=complete --timeout=120s job/${APP_NAME}-init -n ${NAMESPACE} || {
                log_error "Init job failed or timed out"
                kubectl logs -n ${NAMESPACE} job/${APP_NAME}-init --tail=50
                exit 1
            }
        fi
    fi

    # Update deployment with new image and version annotation
    if kubectl get deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" &> /dev/null; then
        log_info "Updating existing deployment"
        CURRENT_VERSION=$(get_current_deployment_version)
        log_info "Current version: ${CURRENT_VERSION}"
        log_info "New version: ${version}"

        # Patch deployment with new image and annotation
        if [ "$DRY_RUN" = false ]; then
            kubectl patch deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" --type=json \
                -p="[
                    {\"op\": \"replace\", \"path\": \"/spec/template/spec/containers/0/image\", \"value\": \"${IMAGE_NAME}:${version}\"},
                    {\"op\": \"add\", \"path\": \"/metadata/annotations/deployment-version\", \"value\": \"${version}\"},
                    {\"op\": \"add\", \"path\": \"/metadata/annotations/previous-version\", \"value\": \"${CURRENT_VERSION}\"},
                    {\"op\": \"add\", \"path\": \"/metadata/annotations/deployment-timestamp\", \"value\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}
                ]"
        else
            log_info "[DRY RUN] Would patch deployment with version ${version}"
        fi
    else
        log_info "Creating new deployment"

        # Create temporary deployment file with versioned image
        if [ "$DRY_RUN" = false ]; then
            cp k8s/deployment.yaml /tmp/deployment-${version}.yaml
            sed -i.bak "s|image: ${IMAGE_NAME}:latest|image: ${IMAGE_NAME}:${version}|g" /tmp/deployment-${version}.yaml

            # Add version annotation
            kubectl apply -f /tmp/deployment-${version}.yaml
            kubectl annotate deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" \
                deployment-version="${version}" \
                deployment-timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
                --overwrite

            rm /tmp/deployment-${version}.yaml /tmp/deployment-${version}.yaml.bak
        else
            log_info "[DRY RUN] Would create deployment with version ${version}"
        fi
    fi

    # Apply service if it doesn't exist
    if ! kubectl get service "$APP_NAME" -n "$NAMESPACE" &> /dev/null; then
        log_info "Creating service"
        run_command "kubectl apply -f k8s/service.yaml" "Creating service..."
    fi

    # Wait for rollout
    if [ "$DRY_RUN" = false ]; then
        log_info "Waiting for deployment to roll out..."
        if kubectl rollout status deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE" --timeout=300s; then
            log_success "Deployment successful!"
        else
            log_error "Deployment rollout failed"
            log_info "Recent events:"
            kubectl get events -n "$NAMESPACE" --sort-by='.lastTimestamp' | tail -10
            exit 1
        fi
    fi

    save_deployment_info "$version"
}

run_tests() {
    log_step "Running post-deployment tests..."

    if [ "$SKIP_TESTS" = true ]; then
        log_warn "Skipping tests (--skip-tests specified)"
        return 0
    fi

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would run post-deployment tests"
        return 0
    fi

    # Check if pod is running
    log_info "Checking pod status..."
    if ! kubectl get pods -n "$NAMESPACE" -l app="$APP_NAME" | grep -q "Running"; then
        log_error "No running pods found"
        return 1
    fi

    # Test API endpoint via port-forward
    log_info "Testing API endpoint via port-forward..."
    POD_NAME=$(kubectl get pod -n "$NAMESPACE" -l app="$APP_NAME" -o jsonpath='{.items[0].metadata.name}')

    # Start port-forward in background
    kubectl port-forward -n "$NAMESPACE" "$POD_NAME" 18080:3000 > /dev/null 2>&1 &
    PF_PID=$!

    # Wait for port-forward to establish
    sleep 3

    local max_retries=10
    local retry=0
    local wait_time=2

    while [ $retry -lt $max_retries ]; do
        if curl -s -f http://localhost:18080/api/files > /dev/null 2>&1; then
            log_success "API endpoint responding correctly"
            kill $PF_PID 2>/dev/null || true
            return 0
        fi

        retry=$((retry + 1))
        if [ $retry -lt $max_retries ]; then
            log_info "Waiting for API to be ready... (attempt $retry/$max_retries)"
            sleep $wait_time
        fi
    done

    kill $PF_PID 2>/dev/null || true
    log_error "API endpoint test failed after $max_retries attempts"
    log_info "Pod logs:"
    kubectl logs -n "$NAMESPACE" "$POD_NAME" --tail=20
    return 1

    log_success "All tests passed"
}

rollback_deployment() {
    log_step "Rolling back deployment..."

    local target_version="$ROLLBACK_VERSION"

    if [ -z "$target_version" ]; then
        # Get previous version from annotation
        target_version=$(kubectl get deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" \
            -o jsonpath='{.metadata.annotations.previous-version}' 2>/dev/null)

        if [ -z "$target_version" ] || [ "$target_version" = "unknown" ]; then
            log_error "No previous version found. Specify version with --rollback <version>"
            exit 1
        fi
    fi

    log_info "Rolling back to version: ${target_version}"

    # Check if the image exists
    if [ "$DRY_RUN" = false ]; then
        # Load the image if it exists in Docker
        if docker image inspect "${IMAGE_NAME}:${target_version}" &> /dev/null; then
            log_info "Loading previous image version to cluster..."
            kind load docker-image "${IMAGE_NAME}:${target_version}" --name "${CLUSTER_NAME}"
        else
            log_warn "Image ${IMAGE_NAME}:${target_version} not found locally. Deployment may fail if image is not in cluster."
        fi
    fi

    # Update deployment
    VERSION="$target_version"
    SKIP_BUILD=true
    SKIP_TESTS=false
    deploy_or_update "$target_version"
}

cleanup_old_resources() {
    log_step "Cleaning up old resources..."

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would clean up old images and completed jobs"
        return 0
    fi

    # Remove old completed init jobs
    log_info "Removing completed init jobs..."
    kubectl delete jobs -n "$NAMESPACE" --field-selector status.successful=1 2>/dev/null || true

    # List Docker images (manual cleanup required)
    log_info "Local Docker images:"
    docker images "${IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

    echo ""
    log_warn "To remove old Docker images, run: docker image rm ${IMAGE_NAME}:<version>"

    log_success "Cleanup complete"
}

show_status() {
    log_step "Deployment Status"
    echo ""

    if [ "$DRY_RUN" = false ]; then
        kubectl get all -n "$NAMESPACE"
        echo ""
        kubectl get pvc -n "$NAMESPACE"
        echo ""

        CURRENT_VERSION=$(get_current_deployment_version)
        echo -e "${CYAN}Current Version:${NC} ${CURRENT_VERSION}"

        POD_NAME=$(kubectl get pod -n "$NAMESPACE" -l app="$APP_NAME" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
        if [ -n "$POD_NAME" ]; then
            echo -e "${CYAN}Pod Name:${NC} ${POD_NAME}"
        fi

        echo ""
        echo -e "${GREEN}Access the application:${NC}"
        echo "  kubectl port-forward -n ${NAMESPACE} svc/${APP_NAME} 3000:3000"
        echo "  Then open: http://localhost:3000"
    else
        log_info "[DRY RUN] Would show deployment status"
    fi
}

# Main execution
main() {
    echo ""
    echo "========================================="
    echo "  Log Converter Deployment Script"
    echo "========================================="
    echo ""

    if [ "$ROLLBACK" = true ]; then
        rollback_deployment
        show_status
        exit 0
    fi

    if [ "$CLEANUP" = true ]; then
        cleanup_old_resources
        exit 0
    fi

    check_prerequisites

    VERSION=$(get_version)
    log_info "Deployment version: ${VERSION}"

    build_image "$VERSION"
    load_image_to_kind "$VERSION"
    deploy_or_update "$VERSION"
    run_tests

    echo ""
    log_success "Deployment completed successfully!"
    echo ""

    show_status
}

# Run main function
main "$@"
