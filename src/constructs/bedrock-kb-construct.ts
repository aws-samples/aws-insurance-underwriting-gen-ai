import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BedrockKnowledgeBase } from 'bedrock-agents-cdk';
import path = require('path');

export interface KnowledgeBaseProps extends cdk.StackProps {
  readonly embeddingsModelArn: string;
  readonly bucket: cdk.aws_s3.Bucket;
  readonly collection: cdk.aws_opensearchserverless.CfnCollection;
  readonly knowledgeBaseRole: cdk.aws_iam.Role;
  readonly customResourceRole: cdk.aws_iam.Role;
}
const defaultProps: Partial<KnowledgeBaseProps> = {};

export class KnowledgeBaseConstruct extends Construct {
  public knowledgeBaseId: string;
  public dataSourceId: string;

  constructor(scope: Construct, id: string, props: KnowledgeBaseProps) {
    super(scope, id);

    props = { ...defaultProps, ...props };

    const collectionName = 'Underwriting-Manual-Knowledge-Base';
    const vectorIndexName = 'bedrock-knowledge-base-default-index';
    const vectorFieldName = 'bedrock-knowledge-base-default-vector';
    const textField = 'AMAZON_BEDROCK_TEXT_CHUNK';
    const metadataField = 'AMAZON_BEDROCK_METADATA';
    const storageConfigurationType = 'OPENSEARCH_SERVERLESS';
    const dataSourceType = 'S3';

    const allowDataPlaneAccessPolicy = new cdk.aws_iam.Policy(this, 'AllowDataPlaneAccessPolicy', {
      statements: [
        new cdk.aws_iam.PolicyStatement({
          effect: cdk.aws_iam.Effect.ALLOW,
          actions: ['aoss:APIAccessAll'],
          resources: [props.collection.attrArn],
        }),
      ],
    });
    allowDataPlaneAccessPolicy.attachToRole(props.knowledgeBaseRole);

    // Create Bedrock Knowledge Base backed by OpenSearch Servereless
    const knowledgeBase = new BedrockKnowledgeBase(this, 'BedrockOpenSearchKnowledgeBase', {
      name: collectionName,
      roleArn: props.knowledgeBaseRole.roleArn,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: props.embeddingsModelArn,
        },
      },
      storageConfiguration: {
        opensearchServerlessConfiguration: {
          collectionArn: props.collection.attrArn,
          fieldMapping: {
            metadataField: metadataField,
            textField: textField,
            vectorField: vectorFieldName,
          },
          vectorIndexName: vectorIndexName,
        },
        type: storageConfigurationType,
      },
      dataSource: {
        name: 'Underwriting-Manual-Data-Source',
        dataSourceConfiguration: {
          s3Configuration: {
            bucketArn: props.bucket.bucketArn,
          },
          type: dataSourceType,
        },
      },
    });

    const onEvent = new cdk.aws_lambda.Function(this, 'OpenSearchCustomResourceFunction', {
      runtime: cdk.aws_lambda.Runtime.PYTHON_3_12,
      handler: 'custom_resource.indices_custom_resource.on_event',
      code: cdk.aws_lambda.Code.fromDockerBuild(path.join(__dirname,'../../assets/custom-resource')),
      timeout: cdk.Duration.seconds(600),
      role: props.customResourceRole,
      environment: {
        COLLECTION_ENDPOINT: props.collection.attrCollectionEndpoint,
        VECTOR_FIELD_NAME: vectorFieldName,
        VECTOR_INDEX_NAME: vectorIndexName,
        TEXT_FIELD: textField,
        METADATA_FIELD: metadataField,
        DIMENSION: props.embeddingsModelArn.includes('cohere') ? '1024' : '1536'
      },
    });

    // Custom resource provider
    const provider = new cdk.custom_resources.Provider(this, 'CustomResourceProvider', {
      onEventHandler: onEvent,
      logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK,
    });

    // Custom resource
    const customResource = new cdk.CustomResource(this, 'CustomResource', {
      serviceToken: provider.serviceToken,
    });

    knowledgeBase.node.addDependency(allowDataPlaneAccessPolicy);
    knowledgeBase.node.addDependency(customResource);

    this.knowledgeBaseId = knowledgeBase.knowledgeBaseId;
    this.dataSourceId = knowledgeBase.dataSourceId;
  }
}
