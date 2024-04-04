# Underwriting Validation using Amazon Bedrock and AWS Step Functions

Underwriting validation process with Generative AI and Retrieval Augmented Generating (RAG) using Amazon Bedrock and AWS Step Functions. 
This repository is an addition to [this]() AWS blog post.

> [!IMPORTANT]
> Upload your underwriting manual document to the [underwriting-manual](./assets/underwriting-manual/) directory after you clone the repo.

## Services used

- [AWS Step Functions](https://aws.amazon.com/step-functions/) - Workflow Orchestration
- [Amazon Bedrock](https://aws.amazon.com/bedrock/) - Generative AI
- [AWS Lambda](https://aws.amazon.com/lambda/) - Serverless Function, FaaS Serverless
- [Amazon EventBridge](https://aws.amazon.com/eventbridge/) - Event Listener
- [Amazon S3](https://aws.amazon.com/s3/) - Cloud Object Storage
- [AWS Identity and Access Management (IAM)](https://aws.amazon.com/iam/) - Securely manage identities and access to AWS services and resources

## Architecture

![AWS Architecture)](https://github.com/maxtybar/gen-ai-underwriting-validation/assets/61300968/e942a393-7a6c-442b-91a8-764485391bd3)

## Prerequisites

Deployment has been tested on MacOS, Windows and Linux machines. Installation guide assumes you have AWS account and Administrator Access to provision all the resources. Make sure you have access to `Anthropic's Claude 2.1 and Claude 3 Haiku models` on Amazon Bedrock and your credentials stored in `~/.aws/credentials` (MacOS) or `C:\Users\username\.aws\credentials` (Windows).

=============

- [Amazon Bedrock Claude](https://www.aboutamazon.com/news/aws/amazon-bedrock-anthropic-ai-claude-3) - Access to the Anthropic's Claude 2.1 and Claude 3 Haiku models on Amazon Bedrock
- [node](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) >= 20.0.0
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) >= 2.15.0
- [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) >= 2.133.0
- [Docker](https://www.docker.com/)

## Deployment

Clone current repository:

```
git clone https://github.com/maxtybar/gen-ai-underwriting-validation.git
```

Navigate to the cloned repository in your terminal/shell. All of the commands are to be executed from the root folder.

Deploy the infrastructure using the following command:

```
chmod +x deploy.sh && ./deploy.sh
```

It will take somewhere from 7 to 10 minutes for the infrastructure to be deployed depending on your machine.

> [!IMPORTANT]
> Note S3 Bucket name from the output. This is the bucket where we are going to upload a document (driving license in our example). It will be in the following format:

```
GenAIUnderwritingValidationStack.UnderwritingBucketName = ...
```

> [!CAUTION]
> To stop incurring any charges delete the infrastructure.

## How to delete

To delete the infrastructure, from within the root folder, run the following command:

```
chmod +x destroy.sh && ./destroy.sh
```
