import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as fs from 'fs';
import * as path from 'path';

export interface StateMachineProps extends cdk.StackProps {
    readonly knowledgeBaseId: string;
    readonly classificationModelARN: string;
    readonly nameAndLicenceExtractionModelARN: string;
    readonly inputS3BucketName: string;
    readonly inputS3BucketClassificationKey: string;
    readonly inputS3BucketExtractNameAndLicenseKey: string;
    readonly retrieveAndGenerateModelARN: string;
    readonly base64EncodeLambdaArn: string;
    readonly dmvAPICallLambdaArn: string;
    readonly awsRegion: string;
}
const defaultProps: Partial<StateMachineProps> = {};

export class StateMachineConstruct extends Construct {
  readonly stateMachine: cdk.aws_stepfunctions.CfnStateMachine;

  constructor(scope: Construct, name: string, props: StateMachineProps) {
    super(scope, name);

    props = { ...defaultProps, ...props };

    const executionRole = new cdk.aws_iam.Role(this, 'StateMachineExecutionRole', {
      assumedBy: new cdk.aws_iam.ServicePrincipal('states.amazonaws.com'),
      inlinePolicies: {
        lambdaInvokePolicy: new cdk.aws_iam.PolicyDocument({
          statements: [
            new cdk.aws_iam.PolicyStatement({
              actions: [
                'bedrock:Retrieve',
                'bedrock:RetrieveAndGenerate',
            ],
              resources: ['*'],
            }),
            new cdk.aws_iam.PolicyStatement({
              actions: ['lambda:InvokeFunction'],
              resources: [
                `${props.base64EncodeLambdaArn}`,
                `${props.dmvAPICallLambdaArn}`,
              ],
            }),
            new cdk.aws_iam.PolicyStatement({
              actions: ['bedrock:InvokeModel'],
              resources: [
                `${props.classificationModelARN}`,
                `${props.nameAndLicenceExtractionModelARN}`,
                `${props.retrieveAndGenerateModelARN}`,
              ]
            }),
            new cdk.aws_iam.PolicyStatement({
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:ListBucket',
                's3:GetObjectVersion',
              ],
              resources: [
                `arn:aws:s3:::${props.inputS3BucketName}`,
                `arn:aws:s3:::${props.inputS3BucketName}/*`,
              ]
            }),
          ],
        }),
      },
    });

    // Read the JSON definition
    const definition = fs.readFileSync(path.join(__dirname, '../../assets/state-machine/step-functions-definition.json'), 'utf-8');
    const parsedDefinition = JSON.parse(definition);                                    
    const updatedParsedDefinition = updateParsedDefinition(parsedDefinition, props);
    const updatedDefinition = JSON.stringify(updatedParsedDefinition);

    this.stateMachine = new cdk.aws_stepfunctions.CfnStateMachine(this, 'StateMachine', {
      stateMachineName: 'UnderwritingValidationStateMachine',
      definition: JSON.parse(updatedDefinition),
      roleArn: executionRole.roleArn,
    });
  }
}

function updateParsedDefinition(parsedDefinition: any, props: any) {
  parsedDefinition.States['Base64 Image Encoding'].Parameters.FunctionName = props.base64EncodeLambdaArn;
  parsedDefinition.States['Classification'].Parameters.ModelId = props.classificationModelARN;
  parsedDefinition.States['Classification'].Parameters.Input.S3Uri = `s3://${props.inputS3BucketName}/${props.inputS3BucketClassificationKey}`;
  parsedDefinition.States['Call DMV with License Info'].Parameters.FunctionName = props.dmvAPICallLambdaArn;
  parsedDefinition.States['Extract Name and License #'].Parameters.Input.S3Uri = `s3://${props.inputS3BucketName}/${props.inputS3BucketExtractNameAndLicenseKey}`;
  parsedDefinition.States['Extract Name and License #'].Parameters.ModelId = props.nameAndLicenceExtractionModelARN;
  parsedDefinition.States['Check against Underwriting Manual'].Parameters.RetrieveAndGenerateConfiguration.KnowledgeBaseConfiguration.KnowledgeBaseId = props.knowledgeBaseId;
  parsedDefinition.States['Check against Underwriting Manual'].Parameters.RetrieveAndGenerateConfiguration.KnowledgeBaseConfiguration.ModelArn = props.retrieveAndGenerateModelARN;

  return parsedDefinition;
} 