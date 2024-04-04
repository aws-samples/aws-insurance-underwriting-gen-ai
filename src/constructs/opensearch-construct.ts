import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface OpenSearchCollectionProps extends cdk.StackProps {
  readonly collectionName: string;
  readonly customResourceRole: cdk.aws_iam.Role;
  readonly knowledgeBaseRole: cdk.aws_iam.Role;
}
const defaultProps: Partial<OpenSearchCollectionProps> = {};

export class OpenSearchCollectionConstruct extends Construct {
  readonly collection: cdk.aws_opensearchserverless.CfnCollection;

  constructor(scope: Construct, id: string, props: OpenSearchCollectionProps) {
    super(scope, id);

    props = { ...defaultProps, ...props };

    // Opensearch encryption policy
    const encryptionPolicy = new cdk.aws_opensearchserverless .CfnSecurityPolicy(this, 'EncryptionPolicy', {
        name: 'embeddings-encryption-policy',
        type: 'encryption',
        description: `Encryption policy for ${props.collectionName} collection.`,
        policy: `
        {
        "Rules": [
            {
            "ResourceType": "collection",
            "Resource": ["collection/${props.collectionName}*"]
            }
        ],
        "AWSOwnedKey": true
        }
        `,
    });
    
    // Opensearch network policy
    const networkPolicy = new cdk.aws_opensearchserverless.CfnSecurityPolicy(this, 'NetworkPolicy', {
        name: 'embeddings-network-policy',
        type: 'network',
        description: `Network policy for ${props.collectionName} collection.`,
        policy: `
        [
            {
            "Rules": [
                {
                "ResourceType": "collection",
                "Resource": ["collection/${props.collectionName}*"]
                },
                {
                "ResourceType": "dashboard",
                "Resource": ["collection/${props.collectionName}*"]
                }
            ],
            "AllowFromPublic": true
            }
        ]
        `,
    });
    
    // Opensearch data access policy
    const dataAccessPolicy = new cdk.aws_opensearchserverless.CfnAccessPolicy(this, 'DataAccessPolicy', {
        name: 'embeddings-access-policy',
        type: 'data',
        description: `Data access policy for ${props.collectionName} collection.`,
        policy: `
        [
            {
            "Rules": [
                {
                "ResourceType": "collection",
                "Resource": ["collection/${props.collectionName}*"],
                "Permission": [
                    "aoss:CreateCollectionItems",
                    "aoss:DescribeCollectionItems",
                    "aoss:DeleteCollectionItems",
                    "aoss:UpdateCollectionItems"
                ]
                },
                {
                "ResourceType": "index",
                "Resource": ["index/${props.collectionName}*/*"],
                "Permission": [
                    "aoss:CreateIndex",
                    "aoss:DeleteIndex",
                    "aoss:UpdateIndex",
                    "aoss:DescribeIndex",
                    "aoss:ReadDocument",
                    "aoss:WriteDocument"
                ]
                }
            ],
            "Principal": [
                "${props.customResourceRole.roleArn}",
                "${props.knowledgeBaseRole.roleArn}"
            ]
            }
        ]
        `,
    });

    // Opensearch servelrless collection
    const opensearchServerlessCollection = new cdk.aws_opensearchserverless.CfnCollection(this, 'OpenSearchServerlessCollection', {
        name: props.collectionName,
        description: 'Collection created by CDK for Underwriting Manual process using GenAI.',
        type: 'VECTORSEARCH',
    });

    opensearchServerlessCollection.node.addDependency(encryptionPolicy);
    opensearchServerlessCollection.node.addDependency(networkPolicy);
    opensearchServerlessCollection.node.addDependency(dataAccessPolicy);

    this.collection = opensearchServerlessCollection;
  }
}
