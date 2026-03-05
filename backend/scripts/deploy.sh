#!/usr/bin/env bash
# HealthSathi Backend Deploy Script — AWS SAM
# All AI via AWS services (Bedrock, Rekognition, Textract, Translate, Polly)
# No external API keys required — IAM roles provide access
set -euo pipefail

ENVIRONMENT=${1:-prod}
AWS_REGION=${2:-us-east-1}
ALERT_EMAIL=${3:-""}
STACK_NAME="healthsathi-backend-${ENVIRONMENT}"

echo "=== HealthSathi Deploy: env=${ENVIRONMENT} region=${AWS_REGION} ==="

# 1. Install shared layer deps
echo ">> Installing shared layer dependencies..."
cd layers/shared/nodejs && npm install --omit=dev && cd ../../..

# 2. SAM build
echo ">> Building Lambda functions..."
sam build --use-container --region "${AWS_REGION}"

# 3. SAM deploy
echo ">> Deploying to AWS..."
sam deploy \
  --stack-name "${STACK_NAME}" \
  --region     "${AWS_REGION}" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --resolve-s3 \
  --parameter-overrides \
    Environment="${ENVIRONMENT}" \
    AlertEmail="${ALERT_EMAIL}" \
    BedrockRegion="${AWS_REGION}" \
  --no-fail-on-empty-changeset

# 4. Print outputs
echo ""
echo "=== Deployment Complete ==="
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${AWS_REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text)

echo "API Endpoint: ${API_ENDPOINT}"
echo ""
echo "Add to healthsathi/.env.local:"
echo "  VITE_API_BASE_URL=${API_ENDPOINT}"
echo ""
echo "Get your API key from AWS Console: API Gateway > API Keys"

# 5. Verify Bedrock model access
echo ""
echo "=== Verifying Bedrock Access ==="
aws bedrock list-foundation-models \
  --region "${AWS_REGION}" \
  --query "modelSummaries[?modelId=='anthropic.claude-3-5-sonnet-20241022-v2:0'].[modelId,modelLifecycle.status]" \
  --output table 2>/dev/null || echo "(Bedrock model check skipped — check AWS Console)"
