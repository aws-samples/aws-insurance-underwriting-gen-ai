import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import path = require('path');
import { KnowledgeBaseConstruct } from './constructs/bedrock-kb-construct';
import { EventBridgeConstruct } from './constructs/event-bridge-construct';
import { StateMachineConstruct } from './constructs/state-machine-construct';
import { LambdaConstruct } from './constructs/lambda-construct';
import { S3BucketConstruct } from './constructs/s3-construct';
import { OpenSearchCollectionConstruct } from './constructs/opensearch-construct';


enum ModelType {
  // Model for anthropic.claude-instant-v1
  ANTHROPIC_CLAUDE_INSTANT_V1_2 = 'anthropic.claude-instant-v1',

  // Model for anthropic.claude-v2
  ANTHROPIC_CLAUDE_V2 = 'anthropic.claude-v2',

  // Model for anthropic.claude-v2:1
  ANTHROPIC_CLAUDE_V2_1 = 'anthropic.claude-v2:1',

  // Model for anthropic.claude-3-haiku-20240307-v1:0
  ANTHROPIC_CLAUDE_V3_HAIKU = 'anthropic.claude-3-haiku-20240307-v1:0',

  // Model for anthropic.claude-3-sonnet-20240229-v1:0
  ANTHROPIC_CLAUDE_V3_SONNET = 'anthropic.claude-3-sonnet-20240229-v1:0',

  // Model for amazon.titan-text-express-v1
  AMAZON_TITAN_TEXT_EXPRESS_V1 = 'amazon.titan-text-express-v1',

  // Model for cohere.embed-english-v3
  COHERE_EMBED_ENGLISH_V3 = 'cohere.embed-english-v3'
}

export interface AppProps extends cdk.StackProps {
  readonly randomPrefix: number;
}
const defaultProps: Partial<AppProps> = {};

export class AppStack extends cdk.Stack {
  private readonly embeddingsModelArn: string;
  private readonly classificationModelARN: string;
  private readonly retrieveAndGenerateModelARN: string;
  private readonly nameAndLicenceExtractionModelARN: string;
  private readonly inputS3BucketClassificationKey: string;
  private readonly inputS3BucketExtractNameAndLicenseKey: string;

  constructor(scope: Construct, name: string, props: AppProps) {
    super(scope, name, props);

    const awsRegion = cdk.Stack.of(this).region;
    const baseBedrockModelArn = `arn:aws:bedrock:${awsRegion}::foundation-model`;

    this.embeddingsModelArn = `${baseBedrockModelArn}/${ModelType.COHERE_EMBED_ENGLISH_V3}`;
    this.classificationModelARN = `${baseBedrockModelArn}/${ModelType.ANTHROPIC_CLAUDE_V3_HAIKU}`;
    this.retrieveAndGenerateModelARN = `${baseBedrockModelArn}/${ModelType.ANTHROPIC_CLAUDE_V3_SONNET}`;
    this.nameAndLicenceExtractionModelARN = `${baseBedrockModelArn}/${ModelType.ANTHROPIC_CLAUDE_V3_HAIKU}`;
    this.inputS3BucketClassificationKey = 'classification_input.json';
    this.inputS3BucketExtractNameAndLicenseKey = 'extract_name_and_license_input.json';

    const underwritingManualBucket = new S3BucketConstruct(this, `UnderwritingManualS3Bucket-${props.randomPrefix}`, {
      bucketName: `underwriting-manual-bucket-${props.randomPrefix}`,
      enableEventBridge: false,
    });

    new cdk.aws_s3_deployment.BucketDeployment(this, 'UploadUnderwritingManual', {
      sources: [cdk.aws_s3_deployment.Source.asset(path.join(__dirname, '../assets/underwriting-manual'))],
      destinationBucket: underwritingManualBucket.bucket,
      retainOnDelete: false,
    });

    const underwritingDocumentBucket = new S3BucketConstruct(this, `DocumentS3Bucket-${props.randomPrefix}`, {
      bucketName: `underwriting-document-bucket-${props.randomPrefix}`,
      enableEventBridge: true,
    });

    const stepFunctionInputBucket = new S3BucketConstruct(this, `StepFunctionInputOutputBucket-${props.randomPrefix}`, {
      bucketName: `step-function-input-bucket-${props.randomPrefix}`,
      enableEventBridge: false,
    });

    const knowledgeBaseRole = new cdk.aws_iam.Role(this, 'BedrockKnowledgeBaseRole', {
      roleName: `AmazonBedrockExecutionRoleForKnowledgeBase_${props.randomPrefix}`,
      assumedBy: new cdk.aws_iam.ServicePrincipal('bedrock.amazonaws.com'),
      inlinePolicies: {
        BedrockKnowledgeBasePolicy: new cdk.aws_iam.PolicyDocument({
          statements: [
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: [
                's3:GetObject', 
                's3:ListBucket'
              ],
              resources: [
                cdk.Stack.of(this).formatArn({
                  service: 's3',
                  resource: underwritingManualBucket.bucket.bucketName,
                  region: '',
                  account: '',
                }),
                cdk.Stack.of(this).formatArn({
                  service: 's3',
                  resource: `${underwritingManualBucket.bucket.bucketName}/*`,
                  region: '',
                  account: '',
                }),
              ],
              conditions: {
                StringEquals: {
                  'aws:PrincipalAccount': this.account,
                },
              },
            }),
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: [
                'bedrock:ListFoundationModels', 
                'bedrock:ListCustomModels'
              ],
              resources: ['*'],
            }),
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['bedrock:InvokeModel'],
              resources: [
                this.embeddingsModelArn,
                this.classificationModelARN,
                this.retrieveAndGenerateModelARN,
                this.nameAndLicenceExtractionModelARN,
              ],
            }),
          ],
        }),
      },
    });

    const customResourceRole = new cdk.aws_iam.Role(this, 'CustomResourceRole', {
      assumedBy: new cdk.aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });

    const collectionConstruct = new OpenSearchCollectionConstruct(this, 'OpenSearchCollection', {
      knowledgeBaseRole: knowledgeBaseRole,
      customResourceRole: customResourceRole,
      collectionName: 'underwriting-manual-collection',
    });

    const knowledgeBase = new KnowledgeBaseConstruct(this, 'KnowledgeBase', {
      embeddingsModelArn: this.embeddingsModelArn,
      knowledgeBaseRole: knowledgeBaseRole,
      collection: collectionConstruct.collection,
      bucket: underwritingManualBucket.bucket,
      customResourceRole: customResourceRole,
    });

    const base64EncodeLambda = new LambdaConstruct(this, 'Base64EncodeLambda', {
      functionName: `Base64EncodeLambda-${props.randomPrefix}`,
      assetCode: cdk.aws_lambda.Code.fromAsset(path.join(__dirname, '../assets/lambda/base64-encode')),
      functionHandler: 'base64_encode',
      inputS3BucketName: stepFunctionInputBucket.bucket.bucketName,
      inputS3BucketClassificationKey: this.inputS3BucketClassificationKey,
      inputS3BucketExtractNameAndLicenseKey: this.inputS3BucketExtractNameAndLicenseKey,
      iamRole: new cdk.aws_iam.Role(this, 'Base64EncodeLambdaRole', {
        assumedBy: new cdk.aws_iam.ServicePrincipal('lambda.amazonaws.com'),
        inlinePolicies: {
          lambdaInvokePolicy: new cdk.aws_iam.PolicyDocument({
            statements: [
              new cdk.aws_iam.PolicyStatement({
                actions: [
                  'logs:CreateLogGroup',
                  'logs:CreateLogStream',
                  'logs:PutLogEvents'
                ],
                resources: ['*'],
              }),
              new cdk.aws_iam.PolicyStatement({
                actions: [
                  's3:ListBucket',
                  's3:PutObject',
                  's3:GetObject',
                  's3:GetObjectVersion',
                ],
                resources: [
                  `arn:aws:s3:::${stepFunctionInputBucket.bucket.bucketName}`,
                  `arn:aws:s3:::${stepFunctionInputBucket.bucket.bucketName}/*`,
                  `arn:aws:s3:::${underwritingDocumentBucket.bucket.bucketName}`,
                  `arn:aws:s3:::${underwritingDocumentBucket.bucket.bucketName}/*`
                ]
              }),
            ],
          }),
        },
      }),
    });

    const dmvAPICallLambda = new LambdaConstruct(this, 'DmvAPICallLambda', {
      functionName: `DmvAPICallLambda-${props.randomPrefix}`,
      assetCode: cdk.aws_lambda.Code.fromAsset(path.join(__dirname, '../assets/lambda/dmv-api-call')),
      functionHandler: 'dmv_api_call',
      iamRole: new cdk.aws_iam.Role(this, 'DmvAPICallLambdaRole', {
        assumedBy: new cdk.aws_iam.ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
      }),
    });

    const stateMachine = new StateMachineConstruct(this, 'StepFunctions', {
      knowledgeBaseId: knowledgeBase.knowledgeBaseId,
      inputS3BucketName: stepFunctionInputBucket.bucket.bucketName,
      inputS3BucketClassificationKey: this.inputS3BucketClassificationKey,
      inputS3BucketExtractNameAndLicenseKey: this.inputS3BucketExtractNameAndLicenseKey,
      classificationModelARN: this.classificationModelARN,
      nameAndLicenceExtractionModelARN: this.nameAndLicenceExtractionModelARN,
      retrieveAndGenerateModelARN: this.retrieveAndGenerateModelARN,
      base64EncodeLambdaArn: base64EncodeLambda.functionArn,
      dmvAPICallLambdaArn: dmvAPICallLambda.functionArn,
      awsRegion: awsRegion
    });

    const eventBridge = new EventBridgeConstruct(this, 'EventBridge', {
      stepFunction: stateMachine.stateMachine,
      bucketName: `underwriting-document-bucket-${props.randomPrefix}`
    });

    // Allow Lambda (custom resource) access to OpenSearch data plane
    const allowAccessToCollectionDataPlanePolicy = new cdk.aws_iam.Policy(this, 'CustomResourcePolicy', {
      statements: [
        new cdk.aws_iam.PolicyStatement({
          resources: [collectionConstruct.collection.attrArn],
          actions: ['aoss:APIAccessAll'],
        }),
      ],
    });
    allowAccessToCollectionDataPlanePolicy.attachToRole(customResourceRole);

    knowledgeBase.node.addDependency(allowAccessToCollectionDataPlanePolicy);
    knowledgeBase.node.addDependency(collectionConstruct);
    stateMachine.node.addDependency(base64EncodeLambda);
    stateMachine.node.addDependency(dmvAPICallLambda);
    stateMachine.node.addDependency(knowledgeBase);
    eventBridge.node.addDependency(stateMachine);

    new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: knowledgeBase.knowledgeBaseId,
      description: 'Knowledge Base ID',
    });

    new cdk.CfnOutput(this, 'DataSourceId', {
      value: knowledgeBase.dataSourceId,
      description: 'Data Source ID',
    });

    new cdk.CfnOutput(this, 'UnderwritingBucketName', {
      value: underwritingDocumentBucket.bucket.bucketName,
      description: 'Underwriting Document Upload Bucket Name',
    });
  }
}