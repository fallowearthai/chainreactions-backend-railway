#!/bin/bash

# Entity Relations Normal Search Service - Test Script
# This script demonstrates all available endpoints

echo "🧪 Entity Relations Normal Search Service - Test Suite"
echo "=========================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "${BLUE}Test 1: Health Check${NC}"
echo "GET http://localhost:3005/api/health"
echo "---"
curl -s http://localhost:3005/api/health | jq
echo ""
echo ""

# Test 2: Service Info
echo -e "${BLUE}Test 2: Service Information${NC}"
echo "GET http://localhost:3005/api/info"
echo "---"
curl -s http://localhost:3005/api/info | jq
echo ""
echo ""

# Test 3: Normal Search (Basic)
echo -e "${BLUE}Test 3: Normal Search - Basic Request${NC}"
echo "POST http://localhost:3005/api/normal-search"
echo "Request Body:"
echo '{
  "Target_institution": "Apple Inc",
  "Risk_Entity": "Military",
  "Location": "United States"
}'
echo "---"
curl -X POST http://localhost:3005/api/normal-search \
  -H "Content-Type: application/json" \
  -d '{
    "Target_institution": "Apple Inc",
    "Risk_Entity": "Military",
    "Location": "United States"
  }' | jq '.raw_data | {risk_item, institution_A, relationship_type, sources_count}'
echo ""
echo ""

# Test 4: Normal Search (With Date Range)
echo -e "${BLUE}Test 4: Normal Search - With Date Range${NC}"
echo "POST http://localhost:3005/api/normal-search"
echo "Request Body:"
echo '{
  "Target_institution": "Apple Inc",
  "Risk_Entity": "Military",
  "Location": "United States",
  "Start_Date": "2023-01-01",
  "End_Date": "2023-12-31"
}'
echo "---"
echo "(This may take 10-30 seconds...)"
curl -X POST http://localhost:3005/api/normal-search \
  -H "Content-Type: application/json" \
  -d '{
    "Target_institution": "Apple Inc",
    "Risk_Entity": "Military",
    "Location": "United States",
    "Start_Date": "2023-01-01",
    "End_Date": "2023-12-31"
  }' | jq '.raw_data | {risk_item, institution_A, relationship_type, finding_summary: (.finding_summary | .[0:200] + "..."), sources_count}'
echo ""
echo ""

echo -e "${GREEN}✅ Test Suite Complete${NC}"
echo "=========================================================="
echo ""
echo "📝 Notes:"
echo "  - Normal search typically takes 10-30 seconds"
echo "  - Service uses Google Web Search via Gemini API"
echo "  - Searches in both English and native language"
echo "  - Response format is compatible with N8N webhook format"
echo ""
echo "🔗 Available Endpoints:"
echo "  POST /api/normal-search - Execute normal search"
echo "  GET  /api/health - Health check"
echo "  GET  /api/info - Service information"
echo ""
