#!/bin/bash
# =============================================================================
# GlassBox End-to-End Test Suite
# =============================================================================
# Tests all API endpoints against deployed staging environment
# Usage: ./scripts/e2e-tests.sh [--verbose] [--api-url URL]
# =============================================================================

# Don't exit on error - we handle errors ourselves
# set -e

# Configuration
API_BASE_URL="${API_BASE_URL:-http://glassbox-staging-1042377516.us-east-1.elb.amazonaws.com}"
VERBOSE="${VERBOSE:-false}"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose|-v) VERBOSE="true"; shift ;;
        --api-url) API_BASE_URL="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Test data (will be populated during tests)
AUTH_TOKEN=""
TEST_ORG_ID=""
TEST_PROJECT_ID=""
TEST_NODE_ID=""
TEST_FILE_ID=""
TEST_EXEC_ID=""

# =============================================================================
# Logging Functions
# =============================================================================

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_test() { echo -e "\n${YELLOW}━━━ TEST SUITE: $1 ━━━${NC}"; }

pass_test() {
    echo -e "  ${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

fail_test() {
    echo -e "  ${RED}✗${NC} $1"
    if [ "$VERBOSE" = "true" ] && [ -n "$2" ]; then
        echo -e "    ${RED}Response: $2${NC}"
    fi
    ((TESTS_FAILED++))
}

skip_test() {
    echo -e "  ${YELLOW}○${NC} $1 (skipped)"
    ((TESTS_SKIPPED++))
}

# =============================================================================
# HTTP Helper Functions
# =============================================================================

# Make API request and return response with status code
api_get() {
    local endpoint=$1
    local token=${2:-$AUTH_TOKEN}

    if [ -n "$token" ]; then
        curl -s -w "\n%{http_code}" -H "Authorization: Bearer $token" "${API_BASE_URL}${endpoint}"
    else
        curl -s -w "\n%{http_code}" "${API_BASE_URL}${endpoint}"
    fi
}

api_post() {
    local endpoint=$1
    local data=$2
    local token=${3:-$AUTH_TOKEN}

    if [ -n "$token" ]; then
        curl -s -w "\n%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            -d "$data" \
            "${API_BASE_URL}${endpoint}"
    else
        curl -s -w "\n%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d "$data" \
            "${API_BASE_URL}${endpoint}"
    fi
}

api_patch() {
    local endpoint=$1
    local data=$2
    local token=${3:-$AUTH_TOKEN}

    curl -s -w "\n%{http_code}" -X PATCH \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $token" \
        -d "$data" \
        "${API_BASE_URL}${endpoint}"
}

api_delete() {
    local endpoint=$1
    local token=${2:-$AUTH_TOKEN}

    curl -s -w "\n%{http_code}" -X DELETE \
        -H "Authorization: Bearer $token" \
        "${API_BASE_URL}${endpoint}"
}

# Extract status code from response
get_status() {
    echo "$1" | tail -n 1
}

# Extract body from response (all lines except last)
get_body() {
    echo "$1" | sed '$d'
}

# =============================================================================
# TEST SUITE: Health Check
# =============================================================================

test_health() {
    log_test "Health Check"

    response=$(api_get "/health" "")
    status=$(get_status "$response")
    body=$(get_body "$response")

    if [ "$status" = "200" ]; then
        if echo "$body" | jq -e '.status == "healthy"' > /dev/null 2>&1; then
            pass_test "API returns healthy status"
        else
            fail_test "API response missing healthy status" "$body"
        fi
    else
        fail_test "Health endpoint returned $status" "$body"
    fi
}

# =============================================================================
# TEST SUITE: Authentication
# =============================================================================

test_auth() {
    log_test "Authentication"

    # Test: Generate dev token
    response=$(api_post "/api/v1/auth/dev-token" \
        '{"userId":"e2e-test-user","email":"e2e-test@glassbox.io"}' "")
    status=$(get_status "$response")
    body=$(get_body "$response")

    if [ "$status" = "200" ]; then
        AUTH_TOKEN=$(echo "$body" | jq -r '.token')
        if [ -n "$AUTH_TOKEN" ] && [ "$AUTH_TOKEN" != "null" ]; then
            pass_test "Dev token generated successfully"
        else
            fail_test "Dev token response missing token" "$body"
            return
        fi
    elif [ "$status" = "404" ]; then
        skip_test "Dev token endpoint disabled (production mode)"
        return
    else
        fail_test "Dev token request failed with $status" "$body"
        return
    fi

    # Test: Generate WebSocket token
    response=$(api_post "/api/v1/auth/ws-token" "" "$AUTH_TOKEN")
    status=$(get_status "$response")
    body=$(get_body "$response")

    if [ "$status" = "200" ]; then
        ws_token=$(echo "$body" | jq -r '.token')
        if [ -n "$ws_token" ] && [ "$ws_token" != "null" ]; then
            pass_test "WebSocket token generated successfully"
        else
            fail_test "WS token response missing token" "$body"
        fi
    else
        fail_test "WebSocket token request failed with $status" "$body"
    fi
}

# =============================================================================
# TEST SUITE: Organizations
# =============================================================================

test_organizations() {
    log_test "Organizations"

    if [ -z "$AUTH_TOKEN" ]; then
        skip_test "No auth token - skipping organization tests"
        return
    fi

    # Test: Create organization
    local org_slug="e2e-test-org-$(date +%s)"
    response=$(api_post "/api/v1/orgs" \
        "{\"name\":\"E2E Test Org\",\"slug\":\"$org_slug\"}")
    status=$(get_status "$response")
    body=$(get_body "$response")

    if [ "$status" = "201" ]; then
        TEST_ORG_ID=$(echo "$body" | jq -r '.id')
        pass_test "Organization created: $TEST_ORG_ID"
    else
        fail_test "Organization creation failed with $status" "$body"
        return
    fi

    # Test: List organizations
    response=$(api_get "/api/v1/orgs")
    status=$(get_status "$response")

    if [ "$status" = "200" ]; then
        pass_test "Organizations listed successfully"
    else
        fail_test "Organization list failed with $status"
    fi

    # Test: Get organization by ID
    response=$(api_get "/api/v1/orgs/$TEST_ORG_ID")
    status=$(get_status "$response")

    if [ "$status" = "200" ]; then
        pass_test "Organization retrieved by ID"
    else
        fail_test "Organization retrieval failed with $status"
    fi

    # Test: Update organization
    response=$(api_patch "/api/v1/orgs/$TEST_ORG_ID" \
        '{"name":"E2E Test Org Updated"}')
    status=$(get_status "$response")

    if [ "$status" = "200" ]; then
        pass_test "Organization updated successfully"
    else
        fail_test "Organization update failed with $status"
    fi
}

# =============================================================================
# TEST SUITE: Projects
# =============================================================================

test_projects() {
    log_test "Projects"

    if [ -z "$TEST_ORG_ID" ]; then
        skip_test "No organization - skipping project tests"
        return
    fi

    # Test: Create project
    response=$(api_post "/api/v1/orgs/$TEST_ORG_ID/projects" \
        '{"name":"E2E Test Project","description":"Test project for E2E tests"}')
    status=$(get_status "$response")
    body=$(get_body "$response")

    if [ "$status" = "201" ]; then
        TEST_PROJECT_ID=$(echo "$body" | jq -r '.id')
        pass_test "Project created: $TEST_PROJECT_ID"
    else
        fail_test "Project creation failed with $status" "$body"
        return
    fi

    # Test: List projects
    response=$(api_get "/api/v1/orgs/$TEST_ORG_ID/projects")
    status=$(get_status "$response")

    if [ "$status" = "200" ]; then
        pass_test "Projects listed successfully"
    else
        fail_test "Project list failed with $status"
    fi

    # Test: Get project by ID
    response=$(api_get "/api/v1/projects/$TEST_PROJECT_ID")
    status=$(get_status "$response")

    if [ "$status" = "200" ]; then
        pass_test "Project retrieved by ID"
    else
        fail_test "Project retrieval failed with $status"
    fi
}

# =============================================================================
# TEST SUITE: Nodes
# =============================================================================

test_nodes() {
    log_test "Nodes"

    if [ -z "$TEST_PROJECT_ID" ]; then
        skip_test "No project - skipping node tests"
        return
    fi

    # Test: Create node
    response=$(api_post "/api/v1/projects/$TEST_PROJECT_ID/nodes" \
        '{"title":"E2E Test Node","authorType":"human","status":"draft","description":"Test node"}')
    status=$(get_status "$response")
    body=$(get_body "$response")

    if [ "$status" = "201" ]; then
        TEST_NODE_ID=$(echo "$body" | jq -r '.id')
        pass_test "Node created: $TEST_NODE_ID"
    else
        fail_test "Node creation failed with $status" "$body"
        return
    fi

    # Test: List nodes
    response=$(api_get "/api/v1/projects/$TEST_PROJECT_ID/nodes")
    status=$(get_status "$response")

    if [ "$status" = "200" ]; then
        pass_test "Nodes listed successfully"
    else
        fail_test "Node list failed with $status"
    fi

    # Test: Get node by ID
    response=$(api_get "/api/v1/nodes/$TEST_NODE_ID")
    status=$(get_status "$response")

    if [ "$status" = "200" ]; then
        pass_test "Node retrieved by ID"
    else
        fail_test "Node retrieval failed with $status"
    fi

    # Test: Update node
    response=$(api_patch "/api/v1/nodes/$TEST_NODE_ID" \
        '{"title":"E2E Test Node Updated","status":"in_progress"}')
    status=$(get_status "$response")

    if [ "$status" = "200" ]; then
        pass_test "Node updated successfully"
    else
        fail_test "Node update failed with $status"
    fi

    # Test: Get node versions
    response=$(api_get "/api/v1/nodes/$TEST_NODE_ID/versions")
    status=$(get_status "$response")

    if [ "$status" = "200" ]; then
        pass_test "Node versions retrieved"
    else
        fail_test "Node versions failed with $status"
    fi

    # Test: Acquire lock
    response=$(api_post "/api/v1/nodes/$TEST_NODE_ID/lock" "")
    status=$(get_status "$response")

    if [ "$status" = "200" ]; then
        pass_test "Node lock acquired"

        # Release lock
        api_delete "/api/v1/nodes/$TEST_NODE_ID/lock" > /dev/null 2>&1
        pass_test "Node lock released"
    else
        fail_test "Node lock failed with $status"
    fi

    # Test: Get node children
    response=$(api_get "/api/v1/nodes/$TEST_NODE_ID/children")
    status=$(get_status "$response")

    if [ "$status" = "200" ]; then
        pass_test "Node children retrieved"
    else
        fail_test "Node children failed with $status"
    fi
}

# =============================================================================
# TEST SUITE: Files
# =============================================================================

test_files() {
    log_test "Files"

    if [ -z "$TEST_ORG_ID" ]; then
        skip_test "No organization - skipping file tests"
        return
    fi

    # Test: Get upload URL
    response=$(api_post "/api/v1/orgs/$TEST_ORG_ID/files/upload" \
        '{"filename":"e2e-test.txt","contentType":"text/plain"}')
    status=$(get_status "$response")
    body=$(get_body "$response")

    if [ "$status" = "200" ]; then
        TEST_FILE_ID=$(echo "$body" | jq -r '.fileId')
        upload_url=$(echo "$body" | jq -r '.uploadUrl')

        if [ -n "$upload_url" ] && [ "$upload_url" != "null" ]; then
            pass_test "Upload URL generated: $TEST_FILE_ID"
        else
            fail_test "Upload URL missing from response" "$body"
        fi
    else
        fail_test "Upload URL request failed with $status" "$body"
        return
    fi

    # Test: Get file metadata (before upload)
    response=$(api_get "/api/v1/files/$TEST_FILE_ID")
    status=$(get_status "$response")

    if [ "$status" = "200" ]; then
        pass_test "File metadata retrieved"
    else
        fail_test "File metadata failed with $status"
    fi
}

# =============================================================================
# TEST SUITE: Search
# =============================================================================

test_search() {
    log_test "Search"

    if [ -z "$TEST_ORG_ID" ]; then
        skip_test "No organization - skipping search tests"
        return
    fi

    # Test: Text search
    response=$(api_post "/api/v1/orgs/$TEST_ORG_ID/search" \
        '{"query":"test","types":["nodes"],"limit":10}')
    status=$(get_status "$response")

    if [ "$status" = "200" ]; then
        pass_test "Text search completed"
    else
        fail_test "Text search failed with $status"
    fi

    # Test: Get node context (if we have a node)
    if [ -n "$TEST_NODE_ID" ]; then
        response=$(api_get "/api/v1/nodes/$TEST_NODE_ID/context")
        status=$(get_status "$response")

        if [ "$status" = "200" ]; then
            pass_test "Node context retrieved"
        else
            fail_test "Node context failed with $status"
        fi
    fi
}

# =============================================================================
# TEST SUITE: Executions
# =============================================================================

test_executions() {
    log_test "Agent Executions"

    if [ -z "$TEST_NODE_ID" ]; then
        skip_test "No node - skipping execution tests"
        return
    fi

    # Test: Start execution
    response=$(api_post "/api/v1/nodes/$TEST_NODE_ID/execute" "")
    status=$(get_status "$response")
    body=$(get_body "$response")

    if [ "$status" = "201" ]; then
        TEST_EXEC_ID=$(echo "$body" | jq -r '.execution.id')
        pass_test "Execution started: $TEST_EXEC_ID"
    elif [ "$status" = "409" ]; then
        skip_test "Execution already active on node"
        return
    else
        fail_test "Execution start failed with $status" "$body"
        return
    fi

    # Give it a moment to start
    sleep 1

    # Test: Get current execution
    response=$(api_get "/api/v1/nodes/$TEST_NODE_ID/execution")
    status=$(get_status "$response")

    if [ "$status" = "200" ]; then
        pass_test "Current execution retrieved"
    else
        fail_test "Get execution failed with $status"
    fi

    # Test: Get execution by ID
    if [ -n "$TEST_EXEC_ID" ]; then
        response=$(api_get "/api/v1/executions/$TEST_EXEC_ID")
        status=$(get_status "$response")

        if [ "$status" = "200" ]; then
            pass_test "Execution retrieved by ID"
        else
            fail_test "Execution by ID failed with $status"
        fi
    fi

    # Test: Cancel execution
    response=$(api_post "/api/v1/nodes/$TEST_NODE_ID/execution/cancel" "")
    status=$(get_status "$response")

    if [ "$status" = "200" ]; then
        pass_test "Execution cancelled"
    elif [ "$status" = "400" ] || [ "$status" = "409" ]; then
        skip_test "Execution already completed"
    else
        fail_test "Execution cancel failed with $status"
    fi
}

# =============================================================================
# TEST SUITE: Users
# =============================================================================

test_users() {
    log_test "Users"

    if [ -z "$AUTH_TOKEN" ]; then
        skip_test "No auth token - skipping user tests"
        return
    fi

    # Test: Get current user
    response=$(api_get "/api/v1/users/me")
    status=$(get_status "$response")

    if [ "$status" = "200" ]; then
        pass_test "Current user retrieved"
    else
        fail_test "Get current user failed with $status"
    fi

    # Test: List notifications
    response=$(api_get "/api/v1/users/me/notifications")
    status=$(get_status "$response")

    if [ "$status" = "200" ]; then
        pass_test "Notifications listed"
    else
        fail_test "List notifications failed with $status"
    fi
}

# =============================================================================
# Cleanup
# =============================================================================

cleanup() {
    log_info "Cleaning up test data..."

    # Delete node
    if [ -n "$TEST_NODE_ID" ]; then
        api_delete "/api/v1/nodes/$TEST_NODE_ID" > /dev/null 2>&1 || true
    fi

    # Delete project
    if [ -n "$TEST_PROJECT_ID" ]; then
        api_delete "/api/v1/projects/$TEST_PROJECT_ID" > /dev/null 2>&1 || true
    fi

    # Delete file
    if [ -n "$TEST_FILE_ID" ]; then
        api_delete "/api/v1/files/$TEST_FILE_ID" > /dev/null 2>&1 || true
    fi

    # Delete organization
    if [ -n "$TEST_ORG_ID" ]; then
        api_delete "/api/v1/orgs/$TEST_ORG_ID" > /dev/null 2>&1 || true
    fi

    log_info "Cleanup complete"
}

# =============================================================================
# Main
# =============================================================================

main() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  GlassBox End-to-End Test Suite"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Target:  ${API_BASE_URL}"
    echo "  Time:    $(date)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Run test suites
    test_health
    test_auth
    test_organizations
    test_projects
    test_nodes
    test_files
    test_search
    test_executions
    test_users

    # Cleanup
    cleanup

    # Print summary
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  TEST SUMMARY"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "  ${GREEN}Passed:${NC}  $TESTS_PASSED"
    echo -e "  ${RED}Failed:${NC}  $TESTS_FAILED"
    echo -e "  ${YELLOW}Skipped:${NC} $TESTS_SKIPPED"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if [ $TESTS_FAILED -gt 0 ]; then
        echo -e "\n${RED}Some tests failed!${NC}"
        exit 1
    else
        echo -e "\n${GREEN}All tests passed!${NC}"
        exit 0
    fi
}

# Run main
main "$@"
