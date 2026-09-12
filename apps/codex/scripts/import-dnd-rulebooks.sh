#!/bin/bash

################################################################################
# NexusCodex D&D Rulebook Importer
#
# Imports all PDF files from a directory into NexusCodex, preserving folder
# structure as tags and checking for duplicates.
#
# Usage:
#   ./scripts/import-dnd-rulebooks.sh [OPTIONS]
#
# Options:
#   --dry-run         Show what would be imported without actually importing
#   --api-url URL     API base URL (default: http://localhost:3000)
#   --source-dir DIR  Source directory (default: /Users/JoelN/Documents/DnD/5e Rulebooks)
#   --user-id ID      User ID for uploads (default: system-import)
#   --campaign ID     Campaign ID to assign documents to (optional)
#   --help            Show this help message
#
# Examples:
#   # Dry run to see what will be imported
#   ./scripts/import-dnd-rulebooks.sh --dry-run
#
#   # Import all documents
#   ./scripts/import-dnd-rulebooks.sh
#
#   # Import to specific campaign
#   ./scripts/import-dnd-rulebooks.sh --campaign "my-campaign-id"
#
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
API_URL="http://localhost:3000"
SOURCE_DIR="/Users/JoelN/Documents/DnD/5e Rulebooks"
USER_ID="system-import"
CAMPAIGN_ID=""
DRY_RUN=false

# Counters
TOTAL_FILES=0
IMPORTED_COUNT=0
SKIPPED_COUNT=0
ERROR_COUNT=0

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --api-url)
      API_URL="$2"
      shift 2
      ;;
    --source-dir)
      SOURCE_DIR="$2"
      shift 2
      ;;
    --user-id)
      USER_ID="$2"
      shift 2
      ;;
    --campaign)
      CAMPAIGN_ID="$2"
      shift 2
      ;;
    --help)
      head -n 30 "$0" | grep "^#" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo -e "${RED}Error: Unknown option $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Validate source directory
if [[ ! -d "$SOURCE_DIR" ]]; then
  echo -e "${RED}Error: Source directory does not exist: $SOURCE_DIR${NC}"
  exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       NexusCodex D&D Rulebook Import Utility              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo -e "  API URL:        $API_URL"
echo -e "  Source Dir:     $SOURCE_DIR"
echo -e "  User ID:        $USER_ID"
echo -e "  Campaign ID:    ${CAMPAIGN_ID:-<none>}"
echo -e "  Dry Run:        $DRY_RUN"
echo ""

# Check if API is reachable
echo -e "${YELLOW}Checking API health...${NC}"
if ! curl -s -f "$API_URL/health" > /dev/null 2>&1; then
  echo -e "${RED}Error: Cannot reach API at $API_URL/health${NC}"
  echo -e "${YELLOW}Make sure NexusCodex services are running:${NC}"
  echo -e "  docker compose up -d"
  exit 1
fi
echo -e "${GREEN}✓ API is reachable${NC}"
echo ""

# Function to get folder tag from path
get_folder_tag() {
  local file_path="$1"
  local rel_path="${file_path#$SOURCE_DIR/}"
  local folder=$(dirname "$rel_path")

  # Convert folder name to tag format
  case "$folder" in
    "Core")
      echo "core"
      ;;
    "Supplements")
      echo "supplements"
      ;;
    "Unearthed Arcana")
      echo "unearthed-arcana"
      ;;
    "Errata and Extras")
      echo "errata"
      ;;
    "Basic Rules")
      echo "basic-rules"
      ;;
    "SRD")
      echo "srd"
      ;;
    "Character Sheets")
      echo "character-sheets"
      ;;
    *)
      echo "other"
      ;;
  esac
}

# Function to determine document type
get_document_type() {
  local folder_tag="$1"

  case "$folder_tag" in
    "core"|"basic-rules"|"srd")
      echo "rulebook"
      ;;
    "supplements"|"unearthed-arcana")
      echo "rulebook"
      ;;
    "character-sheets")
      echo "character_sheet"
      ;;
    *)
      # Default to rulebook to satisfy doc-api enum (rulebook|campaign_note|handout|map|character_sheet|homebrew)
      echo "rulebook"
      ;;
  esac
}

# Function to check if document exists by title
check_duplicate() {
  local title="$1"
  local encoded_title=$(printf %s "$title" | jq -sRr @uri)

  # Search for existing document with same title
  local response=$(curl -s "$API_URL/api/documents?search=$encoded_title")
  local count=$(echo "$response" | jq -r '.total // 0')

  if [[ $count -gt 0 ]]; then
    return 0  # Duplicate exists
  else
    return 1  # No duplicate
  fi
}

# Function to import a single PDF
import_pdf() {
  local file_path="$1"
  local filename=$(basename "$file_path")
  local title="${filename%.pdf}"
  local filesize=$(stat -f%z "$file_path" 2>/dev/null || stat -c%s "$file_path" 2>/dev/null)

  local folder_tag=$(get_folder_tag "$file_path")
  local doc_type=$(get_document_type "$folder_tag")

  echo -e "${BLUE}Processing:${NC} $filename"
  echo -e "  Folder Tag: $folder_tag"
  echo -e "  Type: $doc_type"
  echo -e "  Size: $(numfmt --to=iec-i --suffix=B $filesize 2>/dev/null || echo $filesize bytes)"

  # Check for duplicates
  if check_duplicate "$title"; then
    echo -e "${YELLOW}  ⊘ Skipped (duplicate title)${NC}"
    ((SKIPPED_COUNT++))
    return 0
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${GREEN}  ✓ Would import (dry run)${NC}"
    ((IMPORTED_COUNT++))
    return 0
  fi

  # Build tags array
  local tags="[\"dnd5e\", \"$folder_tag\"]"

  # Build campaigns array
  local campaigns="[]"
  if [[ -n "$CAMPAIGN_ID" ]]; then
    campaigns="[\"$CAMPAIGN_ID\"]"
  fi

  # Create document record
  local create_payload=$(jq -n \
    --arg title "$title" \
    --arg type "$doc_type" \
    --arg format "pdf" \
    --arg uploadedBy "$USER_ID" \
    --arg fileSize "$filesize" \
    --arg fileName "$filename" \
    --argjson tags "$tags" \
    --argjson campaigns "$campaigns" \
    '{
      title: $title,
      type: $type,
      format: $format,
      uploadedBy: $uploadedBy,
      fileSize: ($fileSize | tonumber),
      fileName: $fileName,
      tags: $tags,
      campaigns: $campaigns
    }')

  # Debug: print payload if verbose mode
  if [[ "${VERBOSE:-false}" == "true" ]]; then
    echo -e "  DEBUG: Create Payload:"
    echo "$create_payload" | jq .
  fi

  local create_response=$(curl -s -X POST "$API_URL/api/documents" \
    -H "Content-Type: application/json" \
    -d "$create_payload")

  # Debug: print response if verbose mode
  if [[ "${VERBOSE:-false}" == "true" ]]; then
    echo -e "  DEBUG: API Response:"
    echo "$create_response" | jq .
  fi

  # Check for errors
  if echo "$create_response" | jq -e '.error' > /dev/null 2>&1; then
    local error_msg=$(echo "$create_response" | jq -r '.error')
    local error_details=$(echo "$create_response" | jq -r '.details // ""')
    echo -e "${RED}  ✗ Error creating document: $error_msg${NC}"
    if [[ -n "$error_details" ]]; then
      echo -e "${RED}     Details: $error_details${NC}"
    fi
    ((ERROR_COUNT++))
    return 1
  fi

  local doc_id=$(echo "$create_response" | jq -r '.document.id')
  local upload_url=$(echo "$create_response" | jq -r '.uploadUrl')

  if [[ -z "$doc_id" ]] || [[ "$doc_id" == "null" ]]; then
    echo -e "${RED}  ✗ Error: No document ID returned${NC}"
    ((ERROR_COUNT++))
    return 1
  fi

  echo -e "  Document ID: $doc_id"

  # Debug: print upload URL if verbose mode
  if [[ "${VERBOSE:-false}" == "true" ]]; then
    echo -e "  DEBUG: Upload URL (first 150 chars):"
    echo "${upload_url:0:150}..."
  fi

  # Upload file to S3
  echo -e "  Uploading file..."
  local upload_status=$(curl -s -X PUT "$upload_url" \
    -H "Content-Type: application/pdf" \
    --data-binary "@$file_path" \
    -o /dev/null -w "%{http_code}")

  if ! echo "$upload_status" | grep -q "^2"; then
    echo -e "${RED}  ✗ Error uploading file (HTTP $upload_status)${NC}"
    ((ERROR_COUNT++))
    return 1
  fi

  echo -e "${GREEN}  ✓ File uploaded successfully${NC}"

  # Trigger processing
  echo -e "  Triggering processing..."
  local process_response=$(curl -s -X POST "$API_URL/api/documents/$doc_id/process")

  if echo "$process_response" | jq -e '.error' > /dev/null 2>&1; then
    local error_msg=$(echo "$process_response" | jq -r '.error')
    echo -e "${YELLOW}  ⚠ Warning: Processing trigger failed: $error_msg${NC}"
    echo -e "${GREEN}  ✓ Imported (processing may need manual trigger)${NC}"
  else
    echo -e "${GREEN}  ✓ Imported and processing started${NC}"
  fi

  ((IMPORTED_COUNT++))
  return 0
}

# Main import loop
echo -e "${YELLOW}Scanning for PDF files...${NC}"

# Use find to locate all PDF files (more portable than globstar)
PDF_FILES=()
while IFS= read -r -d '' file; do
  PDF_FILES+=("$file")
done < <(find "$SOURCE_DIR" -type f -name "*.pdf" -print0)

TOTAL_FILES=${#PDF_FILES[@]}

echo -e "${GREEN}Found $TOTAL_FILES PDF files${NC}"
echo ""

if [[ $TOTAL_FILES -eq 0 ]]; then
  echo -e "${YELLOW}No PDF files found in $SOURCE_DIR${NC}"
  exit 0
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo -e "${YELLOW}========================================${NC}"
  echo -e "${YELLOW}DRY RUN MODE - No files will be imported${NC}"
  echo -e "${YELLOW}========================================${NC}"
  echo ""
fi

# Process each PDF
for pdf_file in "${PDF_FILES[@]}"; do
  import_pdf "$pdf_file"
  echo ""
done

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Import Summary                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Total Files:     $TOTAL_FILES"
echo -e "${GREEN}  Imported:        $IMPORTED_COUNT${NC}"
echo -e "${YELLOW}  Skipped:         $SKIPPED_COUNT${NC}"
echo -e "${RED}  Errors:          $ERROR_COUNT${NC}"
echo ""

if [[ "$DRY_RUN" == "true" ]]; then
  echo -e "${YELLOW}This was a dry run. Run without --dry-run to actually import.${NC}"
  echo ""
fi

if [[ $ERROR_COUNT -gt 0 ]]; then
  echo -e "${RED}Import completed with errors. Please review the output above.${NC}"
  exit 1
fi

if [[ "$DRY_RUN" == "false" ]]; then
  echo -e "${GREEN}Import completed successfully!${NC}"
  echo ""
  echo -e "${YELLOW}Next steps:${NC}"
  echo -e "  1. Check processing status: curl $API_URL/api/documents"
  echo -e "  2. View documents in MinIO console: http://localhost:9001"
  echo -e "  3. Monitor processing logs: docker compose logs -f doc-processor"
  echo ""
fi

exit 0
