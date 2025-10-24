#!/bin/bash

# =================================================================
# Environment Variable Validation Script
# =================================================================
# Purpose: Validate all required environment variables for deployment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_header() {
    echo -e "${RED}🔍 Environment Variable Validation${NC}"
    echo -e "${RED}=====================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Required variables and their descriptions
REQUIRED_VARS=(
    "GEMINI_API_KEY:Google Gemini AI API Key for enhanced search"
    "BRIGHT_DATA_API_KEY:Bright Data SERP API Key for web search"
    "BRIGHT_DATA_SERP_ZONE:Bright Data SERP zone configuration"
    "SUPABASE_URL:Supabase PostgreSQL database URL"
    "SUPABASE_ANON_KEY:Supabase anonymous/public key for database access"
    "SUPABASE_SERVICE_ROLE_KEY:Supabase service role key for database operations"
    "LINKUP_API_KEY:Linkup API Key for professional business intelligence"
    "LINKUP_BASE_URL:Linkup API base URL (default: https://api.linkup.so/v1)"
)

# Optional variables
OPTIONAL_VARS=(
    "GEMINI_MODEL:Gemini AI model (default: gemini-2.5-flash)"
    "DEFAULT_MAX_RESULTS_PER_ENGINE:Default max results per search engine"
    "DEDUPLICATION_THRESHOLD:Minimum confidence threshold for entity deduplication"
    "MIN_ENGINES_FOR_HIGH_CONFIDENCE:Minimum engines needed for high confidence matching"
)

print_header

# Check if .env file exists
if [ ! -f .env ]; then
    print_error ".env file not found!"
    print_error "Please create .env file with the following variables:"
    for VAR in "${REQUIRED_VARS[@]}"; do
        echo -e "  ${RED}$VAR${NC}: ${REQUIRED_VARS[$VAR]#*:1}"
    done
    echo -e "\n${YELLOW}Create .env file from template:${NC}"
    echo -e "${BLUE}cp .env.docker.example .env${NC}"
    exit 1
fi

# Load and validate environment variables
source .env

print_success "Environment file loaded successfully"

# Check required variables
echo "🔍 Checking required environment variables..."
MISSING_COUNT=0

for VAR in "${REQUIRED_VARS[@]}"; do
    VAR_NAME="${VAR%%:*}"
    VAR_VALUE=$(eval echo \$$VAR_NAME)

    if [ -z "$VAR_VALUE" ] || [ "$VAR_VALUE" = "your_${VAR_NAME}_here" ]; then
        print_error "❌ $VAR_NAME: Not set or using placeholder value"
        MISSING_COUNT=$((MISSING_COUNT + 1))
    else
        print_success "✅ $VAR_NAME: Set"
    fi
done

# Check optional variables with warnings
echo ""
echo "🔍 Checking optional environment variables..."
for VAR in "${OPTIONAL_VARS[@]}"; do
    VAR_NAME="${VAR%%:*}"
    VAR_VALUE=$(eval echo \$$VAR_NAME)
    VAR_VALUE="${VAR_VALUE:-not_set}"

    if [ "$VAR_VALUE" != "not_set" ]; then
        print_success "✅ $VAR_NAME: $VAR_VALUE"
    else
        print_warning "⚠️  $VAR_NAME: Not set (using default)"
    fi
done

# Validation summary
echo ""
echo -e "${BLUE}=====================================${NC}"
if [ $MISSING_COUNT -eq 0 ]; then
    print_success "🎉 All required environment variables are properly configured!"
    echo -e "${GREEN}Ready for deployment!${NC}"

    # Show configuration summary
    echo ""
    echo -e "${BLUE}📋 Configuration Summary:${NC}"
    echo -e "Required Variables: ${GREEN}✅ All configured${NC}"
    echo -e "Optional Variables: ${YELLOW}Check above${NC}"

    exit 0
else
    print_error "🚨 Validation failed with $MISSING_COUNT missing variables"
    echo -e "${RED}Please update your .env file with the missing values:${NC}"
    echo -e "${BLUE}Required format:${NC}"
    for VAR in "${REQUIRED_VARS[@]}"; do
        VAR_NAME="${VAR%%:*}"
        VAR_DESC="${VAR##*:}"
        echo -e "  ${VAR_NAME}=${VAR_DESC}${NC}"
    done

    exit 1
fi