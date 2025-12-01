#!/bin/bash
# Smoke Test Checklist Script (T090)
# Runs E2E checks and prints OK or failure lines for each step
# Exit code: 0 if all pass, 1 if any fail

set -e

ALL_PASSED=true

print_step() {
    local step=$1
    local success=$2
    local message=$3
    if [ "$success" = true ]; then
        echo "OK $step : $message"
    else
        echo "FAIL $step : $message"
        ALL_PASSED=false
    fi
}

echo ""
echo "=== Smoke Test Checklist ==="
echo ""

# Step 1: Check Webhook Service
if curl -s -f -o /dev/null -w "%{http_code}" http://localhost:4000/health | grep -q "200"; then
    print_step "Step 1" true "Webhook service is running"
else
    print_step "Step 1" false "Webhook service is not running (http://localhost:4000)"
fi

# Step 2: Check Orchestrator Service
if curl -s -f -o /dev/null -w "%{http_code}" http://localhost:5000/health | grep -q "200"; then
    print_step "Step 2" true "Orchestrator service is running"
else
    print_step "Step 2" false "Orchestrator service is not running (http://localhost:5000)"
fi

# Step 3: Check AI Service
if curl -s -f -o /dev/null -w "%{http_code}" http://localhost:8001/health | grep -q "200"; then
    print_step "Step 3" true "AI Review service is running"
else
    print_step "Step 3" false "AI Review service is not running (http://localhost:8001)"
fi

# Step 4: Check Database Connection
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-3308}
if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
    print_step "Step 4" true "Database is reachable ($DB_HOST:$DB_PORT)"
else
    print_step "Step 4" false "Database is not reachable ($DB_HOST:$DB_PORT)"
fi

# Step 5: Check Kafka Connection
KAFKA_BROKER=${KAFKA_BROKER:-localhost:9092}
KAFKA_HOST=$(echo $KAFKA_BROKER | cut -d: -f1)
KAFKA_PORT=$(echo $KAFKA_BROKER | cut -d: -f2)
if nc -z "$KAFKA_HOST" "$KAFKA_PORT" 2>/dev/null; then
    print_step "Step 5" true "Kafka is reachable ($KAFKA_BROKER)"
else
    print_step "Step 5" false "Kafka is not reachable ($KAFKA_BROKER)"
fi

# Step 6: Check Orchestrator Metrics Endpoint
if curl -s -f http://localhost:5000/metrics | grep -q "reviews_total"; then
    print_step "Step 6" true "Orchestrator metrics endpoint is accessible"
else
    print_step "Step 6" false "Orchestrator metrics endpoint not accessible or invalid"
fi

# Step 7: Check AI Review Metrics Endpoint
if curl -s -f http://localhost:8001/metrics | grep -q "reviews_total"; then
    print_step "Step 7" true "AI Review metrics endpoint is accessible"
else
    print_step "Step 7" false "AI Review metrics endpoint not accessible or invalid"
fi

# Summary
echo ""
echo "=== Summary ==="
if [ "$ALL_PASSED" = true ]; then
    echo "OK All checks passed!"
    exit 0
else
    echo "FAIL Some checks failed. Please review the errors above."
    exit 1
fi

