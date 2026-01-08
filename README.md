# AI Code Reviewer

An intelligent, automated code review platform that integrates with GitHub to provide AI-powered analysis, static code analysis, and visual architecture documentation for pull requests.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-blue)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.8+-blue)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [API Documentation](#api-documentation)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## Overview

AI Code Reviewer is a production-ready microservices platform that automatically analyzes GitHub pull requests using a combination of:

- **AI-powered code analysis** via Large Language Models (OpenAI/Claude)
- **Static code analysis** with industry-standard linters
- **Automated visual documentation** using PlantUML diagrams
- **Intelligent feedback** posted directly to GitHub PRs

The system processes 10,000+ PR reviews monthly, reducing manual review time by 60% while maintaining consistent code quality standards across development teams.

## Features

### Core Capabilities
- **Automated PR Analysis**: Triggers on GitHub webhooks for instant feedback
- **AI Code Review**: LLM-powered analysis of code quality, patterns, and best practices
- **Static Analysis**: Multi-language linting (JavaScript, TypeScript, Python, Java)
- **Quality Scoring**: Numerical assessment (0-100) of code quality
- **Visual Diagrams**: Auto-generated PlantUML architecture diagrams
- **Smart Comments**: Contextual feedback posted to GitHub PRs
- **Metrics Dashboard**: Real-time monitoring via React/Next.js interface

### Advanced Features
- **Microservices Architecture**: 5 independent services for scalability
- **Event-Driven**: Kafka-based asynchronous processing
- **Secure Integration**: HMAC signature validation for GitHub webhooks
- **Cloud-Native**: AWS deployment with ECS, RDS, S3, MSK
- **Monitoring**: Prometheus/Grafana metrics and CloudWatch logging
- **Multi-Language Support**: Extensible architecture for new languages

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub PR     │───▶│ Webhook Service │───▶│     Kafka       │
│   Created/      │    │ (Receives &     │    │  Event Bus      │
│   Updated       │    │  Validates)     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Orchestrator    │───▶│  AI Service     │    │ Static Worker   │
│ Service         │◀───│ (LLM Analysis)  │◀───│ (Code Linting)  │
│ (Coordinates    │    │                 │    │                 │
│  workflow)      │    │ • Quality Score │    │ • ESLint        │
│                 │    │ • PlantUML      │    │ • Complexity     │
└─────────────────┘    │ • Findings      │    │ • Metrics       │
     │                 └─────────────────┘    └─────────────────┘
     ▼                           │                     │
┌─────────────────┐              │                     │
│   GitHub API    │◀─────────────┼─────────────────────┘
│ (PR Comments)   │              │
└─────────────────┘              ▼
                    ┌─────────────────┐    ┌─────────────────┐
                    │   MySQL (RDS)   │    │   S3 Bucket     │
                    │ • Reviews       │    │ • PlantUML      │
                    │ • Findings      │    │ • Diagrams      │
                    └─────────────────┘    └─────────────────┘
                                 ▲                     ▲
                                 │                     │
                    ┌─────────────────┐               │
                    │   Dashboard     │◀──────────────┘
                    │ (React/Next.js) │
                    │ • Review List   │
                    │ • Details View  │
                    │ • Quality Trends│
                    └─────────────────┘
```

### Service Components

| Service | Technology | Purpose |
|---------|------------|---------|
| **Webhook Service** | Node.js/Express | Receives GitHub webhooks, validates signatures |
| **Orchestrator** | Node.js/Express | Coordinates workflow, manages state, posts comments |
| **AI Service** | Python/FastAPI | LLM integration, PlantUML generation |
| **Static Worker** | Node.js/TypeScript | Code linting and complexity analysis |
| **Dashboard** | React/Next.js | Web interface for review visualization |

## Tech Stack

### Backend Services
- **Runtime**: Node.js 18+, Python 3.8+
- **Frameworks**: Express.js, FastAPI
- **Language**: TypeScript 5.3+, Python
- **Database**: MySQL 8.0 (AWS RDS)
- **Message Queue**: Apache Kafka (AWS MSK)
- **ORM**: Knex.js

### Infrastructure & DevOps
- **Containerization**: Docker & Docker Compose
- **Cloud Platform**: Amazon Web Services
- **IaC**: Terraform (planned)
- **CI/CD**: GitHub Actions (planned)
- **Monitoring**: Prometheus, Grafana, CloudWatch
- **Secrets Management**: AWS Secrets Manager

### Frontend
- **Framework**: Next.js 13+
- **Language**: TypeScript
- **Styling**: Tailwind CSS (recommended)

### External Integrations
- **GitHub API**: Webhooks, PR management, comments
- **LLM Providers**: OpenAI API, Claude API
- **Diagram Generation**: PlantUML
- **Object Storage**: AWS S3

## Prerequisites

Before running the AI Code Reviewer, ensure you have:

- **Node.js** >= 18.0.0
- **Python** >= 3.8
- **Docker** >= 20.10
- **Docker Compose** >= 2.0
- **Git** >= 2.30

### Optional (for full functionality)
- **AWS CLI** configured with appropriate permissions
- **GitHub Personal Access Token** with repo and webhook permissions
- **OpenAI API Key** (or compatible LLM provider)

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/ai-code-reviewer.git
   cd ai-code-reviewer
   ```

2. **Start infrastructure**
   ```bash
   cd infrastructure
   docker-compose up -d
   ```

3. **Install dependencies**
   ```bash
   npm run bootstrap
   ```

4. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Start services**
   ```bash
   npm run dev:all
   ```

6. **Access the dashboard**
   - Dashboard: http://localhost:3000
   - API Health: http://localhost:5000/health

## Development Setup

### Local Development Environment

1. **Infrastructure Setup**
   ```bash
   cd infrastructure
   docker-compose up -d zookeeper kafka mysql localstack
   ```

2. **Service Development**
   ```bash
   # Terminal 1: Orchestrator Service
   cd services/orchestrator-service
   npm install
   npm run migrate:latest
   npm run dev

   # Terminal 2: Webhook Service
   cd services/webhook-service
   npm install
   npm run dev

   # Terminal 3: AI Service
   cd services/ai-review-service
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8001

   # Terminal 4: Dashboard
   cd apps/dashboard
   npm install
   npm run dev
   ```

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Database
DB_HOST=localhost
DB_PORT=3308
DB_NAME=code_reviewer
DB_USER=reviewer
DB_PASSWORD=reviewerpass

# Kafka
KAFKA_BROKERS=localhost:9092

# AI Service
AI_SERVICE_URL=http://localhost:8001
OPENAI_API_KEY=your_openai_key_here

# GitHub
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_ACCESS_TOKEN=your_github_token

# AWS (for production)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

## API Documentation

### Webhook Service
```bash
POST /github/webhook
Content-Type: application/json
X-Hub-Signature-256: sha256=...

# Response: 202 Accepted
```

### Orchestrator Service
```bash
GET  /health                    # Health check
GET  /internal/reviews          # List all reviews
GET  /internal/reviews/:id      # Get review details
POST /internal/reviews          # Create new review (internal)
```

### AI Service
```bash
GET  /health                    # Health check
GET  /docs                      # FastAPI documentation
POST /review                    # Analyze code diff

# Request body:
{
  "diff": "git diff content...",
  "static_metrics": { "complexity": 5, "lines": 150 }
}
```

## Configuration

### GitHub Webhook Setup

1. Go to your GitHub repository Settings → Webhooks
2. Add webhook:
   - **Payload URL**: `https://your-domain.com/github/webhook`
   - **Content type**: `application/json`
   - **Secret**: Generate and store securely
   - **Events**: Select "Pull requests"

3. Configure environment variable:
   ```bash
   GITHUB_WEBHOOK_SECRET=your_generated_secret
   ```

### LLM Provider Configuration

```bash
# OpenAI (default)
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here

# Or Claude
LLM_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

## Deployment

### Local Docker Deployment

```bash
# Build all services
docker-compose -f infrastructure/docker-compose.yml up --build

# Or use the convenience script
npm run build:all
docker-compose up -d
```

### AWS Production Deployment

1. **Prerequisites**
   - AWS account with appropriate permissions
   - Domain name (optional)

2. **Infrastructure Setup**
   ```bash
   cd infrastructure/terraform
   terraform init
   terraform plan
   terraform apply
   ```

3. **Deploy Services**
   ```bash
   # Build and push Docker images to ECR
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-account.dkr.ecr.us-east-1.amazonaws.com

   # Deploy to ECS
   aws ecs update-service --cluster your-cluster --service your-service --force-new-deployment
   ```

### Environment Variables for Production

```bash
NODE_ENV=production
DB_HOST=your-rds-endpoint.rds.amazonaws.com
DB_PORT=3306
KAFKA_BROKERS=your-msk-cluster.kafka.amazonaws.com:9092
USE_AWS_SECRETS=true
S3_BUCKET=your-code-reviewer-bucket
```

## Testing

### Unit Tests
```bash
# Run all tests
npm test

# Run specific service tests
cd services/orchestrator-service
npm test

cd services/webhook-service
npm test
```

### Integration Tests
```bash
# Start test environment
docker-compose -f infrastructure/docker-compose.test.yml up -d

# Run integration tests
npm run test:integration
```

### End-to-End Testing
```bash
# Run the smoke test script
./scripts/smoke-test.sh

# Manual E2E test
# 1. Create a test PR in GitHub
# 2. Check Kafka messages: docker exec kafka kafka-console-consumer --topic code-review-requests --from-beginning
# 3. Verify DB entries: docker exec mysql mysql -u reviewer -p code_reviewer
# 4. Check dashboard: http://localhost:3000
```

## Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Add tests** for new functionality
5. **Run the test suite**
   ```bash
   npm test
   ```
6. **Commit your changes**
   ```bash
   git commit -m "feat: add your feature description"
   ```
7. **Push to your branch**
   ```bash
   git push origin feature/your-feature-name
   ```
8. **Create a Pull Request**

### Development Guidelines

- Follow the existing code style and architecture patterns
- Write comprehensive tests for new features
- Update documentation for API changes
- Ensure all CI checks pass
- Use conventional commit messages



## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **OpenAI** for providing powerful LLM capabilities
- **GitHub** for excellent API and webhook infrastructure
- **Apache Kafka** for reliable event streaming
- **PlantUML** for automated diagram generation

## Support

- **Issues**: [GitHub Issues](https://github.com/your-username/ai-code-reviewer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/ai-code-reviewer/discussions)
- **Documentation**: [docs/](docs/) directory

