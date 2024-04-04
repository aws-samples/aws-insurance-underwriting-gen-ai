import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface S3BucketProps extends cdk.StackProps {
  readonly bucketName: string;
  readonly enableEventBridge: boolean;
}
const defaultProps: Partial<S3BucketProps> = {};

export class S3BucketConstruct extends Construct {
  readonly bucket: cdk.aws_s3.Bucket;

  constructor(scope: Construct, id: string, props: S3BucketProps) {
    super(scope, id);

    props = { ...defaultProps, ...props };

    this.bucket = new cdk.aws_s3.Bucket(this, `S3Bucket-${props.bucketName}`, {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      bucketName: props.bucketName,
      autoDeleteObjects: true,
      eventBridgeEnabled: props.enableEventBridge,
    });
  }
}
