# AI Code Reviewer - Runbook

This runbook provides step-by-step instructions for running the MVP locally, starting each service, and validating tasks.

## 📋 Prerequisites

Before starting, ensure you have:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Python** (v3.11 or higher) - [Download](https://www.python.org/)
- **Docker** and **Docker Compose** - [Download](https://www.docker.com/)
- **Git** - [Download](https://git-scm.com/)
- **MySQL Client** (optional, for database inspection)

### Verify Prerequisites

```bash
node --version    # Should be v18.0.0 or higher
python --version  # Should be v3.11 or higher
docker --version
docker-compose --version
```

---

## 🚀 Quick Start

### 1. Start Infrastructure

Start all infrastructure services (Kafka, Zookeeper, MySQL, LocalStack) using Docker Compose:

```bash
cd infrastructure
docker-compose up -d
```

**Verify infrastructure is running:**
```bash
docker ps
```

You should see containers for:
- `zookeeper` (port 2181)
- `kafka` (port 9092)
- `mysql` (port 3308)
- `localstack` (port 4566)

**Wait for services to be ready:**
- MySQL: ~10-15 seconds
- Kafka: ~20-30 seconds
- LocalStack: ~10 seconds

### 2. Set Up Database

The database is automatically created by Docker Compose, but you need to run migrations:

```bash
cd services/orchestrator-service
npm install
npm run migrate:latest
```

This creates the `reviews` and `findings` tables.

### 3. Start Services

Start each service in separate terminals (or use a terminal multiplexer like `tmux` or `screen`).

#### Terminal 1: Webhook Service

```bash
cd services/webhook-service
npm install
npm run build
npm start
```

**Expected output:**
```
Webhook service listening on port 4000
Accessible at http://localhost:4000 and via ngrok
```

**Verify:**
```bash
curl http://localhost:4000/health
# Should return: {"status":"ok"}
```

#### Terminal 2: Orchestrator Service

```bash
cd services/orchestrator-service
npm install
npm run build
npm start
```

**Expected output:**
```
Orchestrator service listening on port 5000
Code review consumer started
Static analysis consumer started
```

**Verify:**
```bash
curl http://localhost:5000/health
# Should return: {"status":"ok"}
```

#### Terminal 3: AI Review Service

```bash
cd services/ai-review-service
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8001
```

**Expected output:**
```
INFO:     Started server process
INFO:     Uvicorn running on http://127.0.0.1:8001
```

**Verify:**
```bash
curl http://localhost:8001/health
# Should return: {"status":"ok"}
```

#### Terminal 4: Static Analysis Worker (Optional)

The static analysis worker runs on-demand when triggered by Kafka messages. You can start it manually for testing:

```bash
cd services/static-analysis-worker
npm install
npm run build
npm start
```

---

## 🔧 Environment Variables

### Webhook Service

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Webhook service port |
| `GITHUB_WEBHOOK_SECRET` | `default-secret` | Secret for webhook signature verification |
| `GITHUB_TOKEN` | (empty) | GitHub PAT for fetching file contents |
| `KAFKA_BROKER` | `localhost:9092` | Kafka broker address |

**Example:**
```bash
export GITHUB_TOKEN=ghp_your_token_here
export GITHUB_WEBHOOK_SECRET=your-secret-here
```

### Orchestrator Service

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Orchestrator service port |
| `KAFKA_BROKER` | `localhost:9092` | Kafka broker address |
| `KAFKA_GROUP_ID` | `orchestrator-service` | Kafka consumer group ID |
| `AI_SERVICE_URL` | `http://localhost:8001` | AI Review service URL |
| `USE_MOCK_AI` | `false` | Use mock AI responses (for testing) |
| `GITHUB_TOKEN` | (empty) | GitHub PAT for posting comments |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_PORT` | `3308` | MySQL port |
| `DB_USER` | `reviewer` | MySQL username |
| `DB_PASSWORD` | `reviewerpass` | MySQL password |
| `DB_NAME` | `code_reviewer` | MySQL database name |

**Example:**
```bash
export GITHUB_TOKEN=ghp_your_token_here
export AI_SERVICE_URL=http://localhost:8001
export USE_MOCK_AI=false
```

### AI Review Service

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | (empty) | LLM provider: `openai` or `gemini` |
| `OPENAI_API_KEY` | (empty) | OpenAI API key (if using OpenAI) |
| `GEMINI_API_KEY` | (empty) | Google Gemini API key (if using Gemini) |
| `S3_ENDPOINT_URL` | `http://localhost:4566` | S3 endpoint (LocalStack) |
| `S3_BUCKET` | `code-reviewer-uml` | S3 bucket name |
| `AWS_ACCESS_KEY_ID` | `test` | AWS access key (for LocalStack) |
| `AWS_SECRET_ACCESS_KEY` | `test` | AWS secret key (for LocalStack) |

**Example (Gemini):**
```bash
export LLM_PROVIDER=gemini
export GEMINI_API_KEY=your-gemini-api-key-here
```

**Example (OpenAI):**
```bash
export LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-your-key-here
```

See [docs/ENABLE-REAL-LLM.md](./ENABLE-REAL-LLM.md) for detailed LLM setup instructions.

### Static Analysis Worker

| Variable | Default | Description |
|----------|---------|-------------|
| `KAFKA_BROKER` | `localhost:9092` | Kafka broker address |

---

## ✅ Validation & Testing

### Smoke Test

Run the smoke test to verify all services are running:

```bash
npm run smoke-test
# OR
node scripts/smoke-test.js
```

**Expected output:**
```
=== Smoke Test Checklist ===

OK Step 1 : Webhook service is running
OK Step 2 : Orchestrator service is running
OK Step 3 : AI Review service is running
OK Step 4 : Database is reachable (localhost:3308)
OK Step 5 : Kafka is reachable (localhost:9092)
OK Step 6 : Orchestrator metrics endpoint is accessible
OK Step 7 : AI Review metrics endpoint is accessible

=== Summary ===
OK All checks passed!
```

### E2E Smoke Test

Run the full end-to-end test:

```bash
node scripts/e2e-smoke-test.js
```

This test:
1. Sends a webhook payload
2. Verifies Kafka message was published
3. Checks database for review record
4. Verifies static metrics were updated
5. Checks findings were created
6. Verifies review status is `done`

### Individual Service Tests

#### Webhook Service
```bash
cd services/webhook-service
npm test
```

#### Orchestrator Service
```bash
cd services/orchestrator-service
npm test
```

#### Static Analysis Worker
```bash
cd services/static-analysis-worker
npm test
```

---

## 📝 Task Validation Guide

### T010-T012: Webhook Service

**Validate webhook service:**
```bash
# Health check
curl http://localhost:4000/health

# Test webhook endpoint (will fail without signature, but should return 401, not 404)
curl -X POST http://localhost:4000/github/webhook -H "Content-Type: application/json" -d '{}'
# Expected: 401 Unauthorized (signature required)
```

### T020-T026: Orchestrator Service

**Validate orchestrator:**
```bash
# Health check
curl http://localhost:5000/health

# Check metrics
curl http://localhost:5000/metrics

# Check reviews endpoint
curl http://localhost:5000/internal/reviews
```

**Check database:**
```bash
mysql -h localhost -P 3308 -u reviewer -previewerpass code_reviewer
mysql> SELECT * FROM reviews;
mysql> SELECT * FROM findings;
```

### T030-T035: AI Review Service

**Validate AI service:**
```bash
# Health check
curl http://localhost:8001/health

# Check metrics
curl http://localhost:8001/metrics

# Test review endpoint
curl -X POST http://localhost:8001/review \
  -H "Content-Type: application/json" \
  -d '{"diff": "diff --git a/test.js b/test.js\n+console.log(\"test\");"}'
```

**Check API docs:**
Open http://localhost:8001/docs in your browser to see the Swagger UI.

### T040-T043: Static Analysis Worker

**Validate static analysis worker:**
```bash
cd services/static-analysis-worker
npm test
```

### T061: E2E Test

**Run E2E test:**
```bash
node scripts/e2e-smoke-test.js
```

### T070-T071: Configuration

**Test config validation:**
```bash
# Start orchestrator without required env var (should exit with error)
cd services/orchestrator-service
unset DB_PASSWORD
npm start
# Expected: Error message about missing DB_PASSWORD
```

### T080: Unit Tests

**Run all unit tests:**
```bash
cd services/webhook-service && npm test
cd ../orchestrator-service && npm test
cd ../static-analysis-worker && npm test
```

### T081: Metrics

**Check metrics endpoints:**
```bash
# Orchestrator metrics
curl http://localhost:5000/metrics | grep reviews_total

# AI Review metrics
curl http://localhost:8001/metrics | grep reviews_total
```

### T082: CI/CD

**Validate CI workflow:**
1. Create a PR on GitHub
2. Check the "Actions" tab
3. Verify all CI checks pass

### T090: Smoke Test Script

**Run smoke test:**
```bash
npm run smoke-test
# OR
node scripts/smoke-test.js
```

---

## 🔍 Troubleshooting

### Services Won't Start

**Port already in use:**
```bash
# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 4000).OwningProcess | Stop-Process

# Linux/Mac
lsof -ti:4000 | xargs kill
```

**Or use a different port:**
```bash
PORT=4001 npm start
```

### Kafka Connection Issues

**Check Kafka is running:**
```bash
docker ps | grep kafka
```

**Check Kafka logs:**
```bash
docker logs kafka
```

**Restart Kafka:**
```bash
cd infrastructure
docker-compose restart kafka
```

### Database Connection Issues

**Check MySQL is running:**
```bash
docker ps | grep mysql
```

**Check MySQL logs:**
```bash
docker logs mysql
```

**Test connection:**
```bash
mysql -h localhost -P 3308 -u reviewer -previewerpass code_reviewer -e "SELECT 1;"
```

**Reset database:**
```bash
cd infrastructure
docker-compose down -v  # WARNING: Deletes all data
docker-compose up -d mysql
cd ../services/orchestrator-service
npm run migrate:latest
```

### AI Service Not Responding

**Check if service is running:**
```bash
curl http://localhost:8001/health
```

**Check logs for errors:**
Look for Python errors in the terminal where you started the AI service.

**Verify environment variables:**
```bash
# Windows PowerShell
$env:LLM_PROVIDER
$env:GEMINI_API_KEY

# Linux/Mac
echo $LLM_PROVIDER
echo $GEMINI_API_KEY
```

### Webhook Not Receiving Events

**Check webhook service is accessible:**
```bash
curl http://localhost:4000/health
```

**For GitHub webhooks, use ngrok:**
```bash
ngrok http 4000
```

Then update GitHub webhook URL to: `https://your-ngrok-url.ngrok.io/github/webhook`

See [docs/GITHUB-WEBHOOK-URL.md](./GITHUB-WEBHOOK-URL.md) for detailed instructions.

### Metrics Not Showing

**Check metrics endpoints:**
```bash
curl http://localhost:5000/metrics
curl http://localhost:8001/metrics
```

**Verify Prometheus format:**
The response should contain lines like:
```
reviews_total{status="done"} 5
ai_latency_ms_bucket{le="1000"} 3
```

### TypeScript Build Errors

**Clean and rebuild:**
```bash
cd services/orchestrator-service
rm -rf dist node_modules
npm install
npm run build
```

### Python Import Errors

**Reinstall dependencies:**
```bash
cd services/ai-review-service
pip install -r requirements.txt
```

---

## 🛑 Stopping Services

### Stop All Services

1. **Stop application services:**
   - Press `Ctrl+C` in each terminal running a service

2. **Stop infrastructure:**
   ```bash
   cd infrastructure
   docker-compose down
   ```

### Stop Infrastructure Only (Keep Data)

```bash
cd infrastructure
docker-compose stop
```

### Stop and Remove All Data

```bash
cd infrastructure
docker-compose down -v  # WARNING: Deletes all data
```

---

## 📊 Monitoring & Debugging

### Check Service Logs

**Application services:** Check the terminal where you started each service.

**Infrastructure services:**
```bash
docker logs kafka
docker logs mysql
docker logs zookeeper
docker logs localstack
```

### Check Database

```bash
mysql -h localhost -P 3308 -u reviewer -previewerpass code_reviewer

# Useful queries:
SELECT * FROM reviews ORDER BY created_at DESC LIMIT 10;
SELECT * FROM findings WHERE review_id = 1;
SELECT status, COUNT(*) FROM reviews GROUP BY status;
```

### Check Kafka Topics

```bash
# List topics (requires kafka tools)
docker exec -it kafka kafka-topics --list --bootstrap-server localhost:9092

# Check messages in a topic
docker exec -it kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic code-review-requests --from-beginning
```

### Check Metrics

**Orchestrator metrics:**
```bash
curl http://localhost:5000/metrics
```

**AI Review metrics:**
```bash
curl http://localhost:8001/metrics
```

---

## 🔄 Common Workflows

### Full System Restart

```bash
# 1. Stop everything
cd infrastructure && docker-compose down
# Stop all service terminals (Ctrl+C)

# 2. Start infrastructure
docker-compose up -d

# 3. Wait for services to be ready (~30 seconds)
sleep 30

# 4. Run migrations
cd ../services/orchestrator-service
npm run migrate:latest

# 5. Start all services (in separate terminals)
# Terminal 1: webhook-service
# Terminal 2: orchestrator-service
# Terminal 3: ai-review-service

# 6. Verify with smoke test
cd ../..
npm run smoke-test
```

### Testing a Real GitHub PR

1. **Start all services** (see Quick Start)
2. **Start ngrok:**
   ```bash
   ngrok http 4000
   ```
3. **Configure GitHub webhook:**
   - URL: `https://your-ngrok-url.ngrok.io/github/webhook`
   - Secret: `default-secret` (or your `GITHUB_WEBHOOK_SECRET`)
   - Events: Pull requests
4. **Create or update a PR** in your GitHub repository
5. **Check logs** in orchestrator and webhook services
6. **Check database** for new review records

---

## 📚 Additional Resources

- [Architecture Documentation](./architecture.md)
- [Enable Real LLM](./ENABLE-REAL-LLM.md)
- [GitHub Webhook Setup](./GITHUB-WEBHOOK-URL.md)
- [Production Readiness Checklist](./PRODUCTION-READINESS.md)
- [Task List](./tasks.md)

---

## 🆘 Getting Help

If you encounter issues not covered in this runbook:

1. Check the service logs for error messages
2. Verify all environment variables are set correctly
3. Ensure all infrastructure services are running
4. Run the smoke test to identify which component is failing
5. Check the [Production Readiness](./PRODUCTION-READINESS.md) document for known issues

---

**Last Updated:** 2024-11-17

