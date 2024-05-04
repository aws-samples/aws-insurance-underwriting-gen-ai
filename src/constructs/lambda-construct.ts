import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import path = require('path');

export interface LambdaProps extends cdk.StackProps {
    readonly functionName: string;
    readonly functionHandler: string;
    readonly iamRole: cdk.aws_iam.Role;
    readonly assetCode: cdk.aws_lambda.AssetCode;
    readonly inputS3BucketName?: string;
    readonly inputS3BucketClassificationKey?: string;
    readonly inputS3BucketExtractNameAndLicenseKey?: string;
    readonly inputS3BucketFinalPromptKey?: string;
}
const defaultProps: Partial<LambdaProps> = {};

export class LambdaConstruct extends Construct {
  readonly functionArn: string;

  constructor(scope: Construct, id: string, props: LambdaProps) {
    super(scope, id);

    props = { ...defaultProps, ...props };

    const lambda = new cdk.aws_lambda.Function(this, `Lambda-${props.functionName}`, {
        functionName: props.functionName,
        runtime: cdk.aws_lambda.Runtime.PYTHON_3_12,
        code: props.assetCode,
        handler: `${props.functionHandler}.lambda_handler`,
        timeout: cdk.Duration.seconds(30),
        environment: {
          ...(props.inputS3BucketName ? 
            { INPUT_S3_BUCKET_NAME: props.inputS3BucketName } : {}),

          ...(props.inputS3BucketClassificationKey ? 
            { INPUT_S3_BUCKET_CLASSIFICATION_KEY: 
              props.inputS3BucketClassificationKey } : {}),

          ...(props.inputS3BucketExtractNameAndLicenseKey ? 
            { INPUT_S3_BUCKET_EXTRACT_NAME_AND_LICENSE_KEY: 
              props.inputS3BucketExtractNameAndLicenseKey } : {}),

          ...(props.inputS3BucketFinalPromptKey ?
            { INPUT_S3_BUCKET_FINAL_PROMPT_KEY: 
              props.inputS3BucketFinalPromptKey } : {}),
        },
        role: props.iamRole,
    });

    lambda.grantInvoke(new cdk.aws_iam.ServicePrincipal("states.amazonaws.com"));
    this.functionArn = lambda.functionArn;
  }
}
