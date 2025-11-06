#!/bin/bash
set -e

# Step 1. Deploy infrastructure (creates S3 + API Gateway + Lambda)
cd infra
npm run build
cdk deploy --require-approval never --outputs-file ../cdk-outputs.json
cd ..

# Step 2. Extract outputs from the generated JSON file
API_URL=$(jq -r '.InfraStack.ApiEndpoint' cdk-outputs.json)
FRONTEND_URL=$(jq -r '.InfraStack.FrontendURL' cdk-outputs.json)

# Extract bucket name from the FrontendURL (strip "http://" and region suffix)
FRONTEND_BUCKET=$(echo $FRONTEND_URL | sed 's#http://##; s#.s3-website.*##')

echo "✅ API Gateway endpoint: $API_URL"
echo "✅ Frontend bucket name: $FRONTEND_BUCKET"

# Step 3. Build the frontend with the correct API URL
cd frontend
rm -rf dist
VITE_API_URL=$API_URL npm run build

# Step 4. Upload built files to S3
aws s3 sync dist/ s3://$FRONTEND_BUCKET --delete

echo "✅ Frontend successfully uploaded."
echo "🌐 Visit: $FRONTEND_URL"
