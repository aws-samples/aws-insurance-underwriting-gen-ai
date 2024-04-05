import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { bedrock,
  opensearchserverless,
  opensearch_vectorindex 
 } from '@cdklabs/generative-ai-cdk-constructs';

export interface KnowledgeBaseProps extends cdk.StackProps {
  readonly bucket: cdk.aws_s3.Bucket;
}
const defaultProps: Partial<KnowledgeBaseProps> = {};

export class KnowledgeBaseConstruct extends Construct {
  public knowledgeBaseId: string;
  public dataSourceId: string;

  constructor(scope: Construct, id: string, props: KnowledgeBaseProps) {
    super(scope, id);

    props = { ...defaultProps, ...props };

    const vectorStore = new opensearchserverless.VectorCollection(this, 'VectorCollection');

    const vectorIndex = new opensearch_vectorindex.VectorIndex(this, 'VectorIndex', {
      collection: vectorStore,
      indexName: 'bedrock-knowledge-base-default-index',
      vectorField: 'bedrock-knowledge-base-default-vector',
      vectorDimensions: 1024,
      mappings: [
        {
          mappingField: 'AMAZON_BEDROCK_TEXT_CHUNK',
          dataType: 'text',
          filterable: true,
        },
        {
          mappingField: 'AMAZON_BEDROCK_METADATA',
          dataType: 'text',
          filterable: false,
        },
      ],
    });

    const knowledgeBase = new bedrock.KnowledgeBase(this, 'KnowledgeBase', {
      vectorStore: vectorStore,
      vectorIndex: vectorIndex,
      embeddingsModel: bedrock.BedrockFoundationModel.COHERE_EMBED_ENGLISH_V3,
      instruction: `Use this underwiting manual to determine if the specified persona is qualified for insurance
                    coverage based on the provided information.`,
    });

    const dataSource = new bedrock.S3DataSource(this, 'DataSource', {
      bucket: props.bucket,
      knowledgeBase: knowledgeBase,
      dataSourceName: 'underwriting-manual',
      chunkingStrategy: bedrock.ChunkingStrategy.DEFAULT,
      maxTokens: 500,
    });

    vectorIndex.node.addDependency(vectorStore);

    this.knowledgeBaseId = knowledgeBase.knowledgeBaseId;
    this.dataSourceId = dataSource.dataSourceId;
  }
}
