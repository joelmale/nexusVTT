#!/bin/bash
# Multi-stage Docker build optimized for speed
# - Uses BuildKit cache mounts for npm and Vite
# - Copies files in layers for better caching
# - Excludes unnecessary files via .dockerignore
# - Optimized caching strategy for faster rebuilds
set -euo pipefail

DOCKER_IMAGE="joelmale/nexus-forge:latest"
DOCKER_IMAGE_BUILDER="${DOCKER_IMAGE}-builder"

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" >&2
}

log "🚀 Building and pushing optimized Docker images: $DOCKER_IMAGE"
log "⏱️  Start time: $(date '+%Y-%m-%d %H:%M:%S')"
BUILD_START=$(date +%s)

# Enable BuildKit for faster builds
export DOCKER_BUILDKIT=1

# Use or create buildx builder
BUILDER_NAME="multi-arch-builder"

log "🔍 Checking for existing builder: $BUILDER_NAME"
if docker buildx use $BUILDER_NAME 2>/dev/null; then
    log "📦 Using existing $BUILDER_NAME builder..."
else
    log "📦 Creating $BUILDER_NAME builder..."
    docker buildx create --name $BUILDER_NAME --use
fi

# Ensure builder is ready
log "🔄 Ensuring builder is bootstrapped..."
docker buildx inspect --bootstrap $BUILDER_NAME

echo ""
log "🏗️  Building builder stage for cache..."
log "⏱️  Builder stage start: $(date '+%H:%M:%S')"
BUILDER_START=$(date +%s)

# Ensure cache directories exist
mkdir -p /tmp/.buildx-cache
mkdir -p /tmp/.buildx-cache-new

# Build builder stage with proper caching (removed --no-cache)
log "🔨 Building builder stage..."
if ! docker buildx build \
    --progress=plain \
    --target builder \
    --platform linux/amd64,linux/arm64 \
    --cache-from type=local,src=/tmp/.buildx-cache \
    --cache-to type=local,dest=/tmp/.buildx-cache-new,mode=max \
    --tag "$DOCKER_IMAGE_BUILDER" \
    --push \
    .; then
    log "❌ Builder stage failed"
    exit 1
fi

BUILDER_END=$(date +%s)
BUILDER_DURATION=$((BUILDER_END - BUILDER_START))
log "✅ Builder stage completed in ${BUILDER_DURATION}s"

echo ""
log "🏗️  Building and pushing final production image..."
log "⏱️  Production stage start: $(date '+%H:%M:%S')"
PRODUCTION_START=$(date +%s)

# Ensure cache directory exists
mkdir -p /tmp/.buildx-cache

# Build and push final production image with cache (removed --no-cache)
log "🔨 Building production image..."
if ! docker buildx build \
    --progress=plain \
    --platform linux/amd64,linux/arm64 \
    --cache-from type=local,src=/tmp/.buildx-cache \
    --cache-from "$DOCKER_IMAGE_BUILDER" \
    --tag "$DOCKER_IMAGE" \
    --push \
    .; then
    log "❌ Production build failed"
    exit 1
fi

PRODUCTION_END=$(date +%s)
PRODUCTION_DURATION=$((PRODUCTION_END - PRODUCTION_START))
log "✅ Production stage completed in ${PRODUCTION_DURATION}s"

# Clean up and rotate cache
echo ""
log "🧹 Rotating build cache..."
rm -rf /tmp/.buildx-cache
if [ -d /tmp/.buildx-cache-new ]; then
    mv /tmp/.buildx-cache-new /tmp/.buildx-cache || log "Warning: Cache rotation failed"
else
    log "Warning: No new cache directory found"
fi

BUILD_END=$(date +%s)
TOTAL_DURATION=$((BUILD_END - BUILD_START))

echo ""
echo "════════════════════════════════════════════════════════════"
echo "📊 Build Summary"
echo "════════════════════════════════════════════════════════════"
echo "Builder stage:     ${BUILDER_DURATION}s"
echo "Production stage:  ${PRODUCTION_DURATION}s"
echo "────────────────────────────────────────────────────────────"
echo "Total time:        ${TOTAL_DURATION}s"
echo "End time:          $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Build analytics
if [ $TOTAL_DURATION -gt 0 ]; then
    BUILD_MINUTES=$((TOTAL_DURATION / 60))
    BUILD_SECONDS=$((TOTAL_DURATION % 60))
    echo "⏱️  Build Performance:"
    echo "   - Total: ${BUILD_MINUTES}m ${BUILD_SECONDS}s"
    echo "   - Builder efficiency: $((BUILDER_DURATION * 100 / TOTAL_DURATION))% of total time"
    echo "   - Production efficiency: $((PRODUCTION_DURATION * 100 / TOTAL_DURATION))% of total time"
    echo ""
fi

# Get container sizes for both architectures
echo "📏 Container Sizes:"
echo "────────────────────────────────────────────────────────────"

# Function to get human-readable size
get_size() {
    local size_bytes=$1
    if [ "$size_bytes" -ge 1073741824 ] 2>/dev/null; then
        # Calculate GB with one decimal place
        local gb=$(( size_bytes / 1073741824 ))
        local remainder=$(( size_bytes % 1073741824 ))
        local decimal=$(( remainder * 10 / 1073741824 ))
        echo "${gb}.${decimal}GB"
    elif [ "$size_bytes" -ge 1048576 ] 2>/dev/null; then
        # Calculate MB with one decimal place
        local mb=$(( size_bytes / 1048576 ))
        local remainder=$(( size_bytes % 1048576 ))
        local decimal=$(( remainder * 10 / 1048576 ))
        echo "${mb}.${decimal}MB"
    elif [ "$size_bytes" -ge 1024 ] 2>/dev/null; then
        # Calculate KB with one decimal place
        local kb=$(( size_bytes / 1024 ))
        local remainder=$(( size_bytes % 1024 ))
        local decimal=$(( remainder * 10 / 1024 ))
        echo "${kb}.${decimal}KB"
    else
        echo "${size_bytes}B"
    fi
}

# Try to get sizes from local images first (most reliable)
if docker images $DOCKER_IMAGE --format "{{.Size}}" 2>/dev/null | head -1 | grep -q .; then
    log "📦 Using local image sizes..."
docker images $DOCKER_IMAGE --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"
else
    log "🔍 Inspecting registry images..."

    # Try to get sizes from registry using buildx imagetools
    if command -v jq >/dev/null 2>&1; then
        # Use jq for reliable JSON parsing if available
        MANIFEST_INFO=$(docker buildx imagetools inspect $DOCKER_IMAGE --format "{{json .}}" 2>/dev/null)
        if [ -n "$MANIFEST_INFO" ]; then
            # Extract sizes for each platform using jq
            AMD64_SIZE=$(echo "$MANIFEST_INFO" | jq -r '.manifests[] | select(.platform.architecture == "amd64") | .size' 2>/dev/null | head -1)
            ARM64_SIZE=$(echo "$MANIFEST_INFO" | jq -r '.manifests[] | select(.platform.architecture == "arm64") | .size' 2>/dev/null | head -1)

            if [ -n "$AMD64_SIZE" ] && [ "$AMD64_SIZE" != "null" ]; then
                AMD64_SIZE_HUMAN=$(get_size "$AMD64_SIZE")
                echo "AMD64 (x86_64):    $AMD64_SIZE_HUMAN"
            else
                echo "AMD64 (x86_64):    Size unavailable"
            fi

            if [ -n "$ARM64_SIZE" ] && [ "$ARM64_SIZE" != "null" ]; then
                ARM64_SIZE_HUMAN=$(get_size "$ARM64_SIZE")
                echo "ARM64 (aarch64):  $ARM64_SIZE_HUMAN"
            else
                echo "ARM64 (aarch64):  Size unavailable"
            fi

            # Calculate total size if both are available
            if [ -n "$AMD64_SIZE" ] && [ -n "$ARM64_SIZE" ] && [ "$AMD64_SIZE" != "null" ] && [ "$ARM64_SIZE" != "null" ]; then
                TOTAL_SIZE=$((AMD64_SIZE + ARM64_SIZE))
                TOTAL_SIZE_HUMAN=$(get_size "$TOTAL_SIZE")
                echo "Total (both):      $TOTAL_SIZE_HUMAN"
            fi
        else
            echo "Unable to retrieve image size information from registry"
        fi
    else
        log "⚠️  jq not available, size reporting limited"
        echo "AMD64 (x86_64):    Size unavailable (install jq for better reporting)"
        echo "ARM64 (aarch64):  Size unavailable (install jq for better reporting)"
    fi
fi

echo "════════════════════════════════════════════════════════════"
echo ""
log "✅ Successfully built and pushed $DOCKER_IMAGE for amd64 and arm64!"
echo ""
echo "🌟 Build completed successfully!"
echo "   - Images available: $DOCKER_IMAGE"
echo "   - Architectures: linux/amd64, linux/arm64"
echo "   - Cache optimized for future builds"
echo ""
echo "🚀 Ready for deployment!"