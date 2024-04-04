#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AppStack } from '../src/app-stack';

const app = new cdk.App();

// Generate random number to avoid S3 duplicates
const randomPrefix = Math.floor(Math.random() * (1000 - 100) + 100);

new AppStack(app, 'GenAIUnderwritingValidationStack', {
    randomPrefix: randomPrefix,
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
});