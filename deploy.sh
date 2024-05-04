#!/bin/sh

set -e

npm install
aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws
cdk bootstrap
cdk deploy --require-approval never

STACK_OUTPUTS=$(aws cloudformation describe-stacks --stack-name GenAIUnderwritingValidationStack --query "Stacks[0].Outputs")

export KNOWLEDGE_BASE_ID=$(echo $STACK_OUTPUTS | jq -r '.[] | select(.OutputKey=="KnowledgeBaseId") | .OutputValue')
export DATASOURCE_ID=$(echo $STACK_OUTPUTS | jq -r '.[] | select(.OutputKey=="DataSourceId") | .OutputValue')
export S3_BUCKET=$(echo $STACK_OUTPUTS | jq -r '.[] | select(.OutputKey=="UnderwritingBucketURL") | .OutputValue')

aws bedrock-agent start-ingestion-job --knowledge-base-id $KNOWLEDGE_BASE_ID --data-source-id $DATASOURCE_ID

sleep 10

echo
echo "Here is the S3 bucket URL where you need to upload the license: $S3_BUCKET"
echo