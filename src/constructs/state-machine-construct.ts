import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as fs from 'fs';
import * as path from 'path';

export interface StateMachineProps extends cdk.StackProps {
    readonly knowledgeBaseId: string;
    readonly classificationModelARN: string;
    readonly nameAndLicenceExtractionModelARN: string;
    readonly finalResultModelARN: string;
    readonly inputS3BucketName: string;
    readonly inputS3BucketClassificationKey: string;
    readonly inputS3BucketExtractNameAndLicenseKey: string;
    readonly inputS3BucketFinalPromptKey: string;
    readonly base64EncodeLambdaArn: string;
    readonly dmvAPICallLambdaArn: string;
    readonly combineRetrievedInformationLambdaArn: string,
    readonly generateFinalPromptLambdaArn: string,
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
                `${props.combineRetrievedInformationLambdaArn}`,
                `${props.generateFinalPromptLambdaArn}`,
              ],
            }),
            new cdk.aws_iam.PolicyStatement({
              actions: ['bedrock:InvokeModel'],
              resources: [
                `${props.classificationModelARN}`,
                `${props.nameAndLicenceExtractionModelARN}`,
                `${props.finalResultModelARN}`,
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

  const promptFilePath = path.join(__dirname, '../../assets/state-machine/retrieve_underwriting_information.prompt');
  const promptText = fs.readFileSync(promptFilePath, 'utf8');

  parsedDefinition.States['Base64 Image Encoding'].Parameters.FunctionName = props.base64EncodeLambdaArn;
  parsedDefinition.States['Classification'].Parameters.ModelId = props.classificationModelARN;
  parsedDefinition.States['Classification'].Parameters.Input.S3Uri = `s3://${props.inputS3BucketName}/${props.inputS3BucketClassificationKey}`;
  
  parsedDefinition.States['Parallel'].Branches.forEach((branch: any) => {
    if (branch.States['Extract Name and License #']) {
      branch.States['Extract Name and License #'].Parameters.Input.S3Uri = `s3://${props.inputS3BucketName}/${props.inputS3BucketExtractNameAndLicenseKey}`;
      branch.States['Extract Name and License #'].Parameters.ModelId = props.nameAndLicenceExtractionModelARN;
      branch.States['Call DMV with License Info'].Parameters.FunctionName = props.dmvAPICallLambdaArn;
    } else if (branch.States['Retrieve information from Underwriting Manual']) {
      branch.States['Retrieve information from Underwriting Manual'].Parameters.KnowledgeBaseId = props.knowledgeBaseId;
      branch.States['Retrieve information from Underwriting Manual'].Parameters.RetrievalQuery.Text = promptText;
      branch.States['Combine Retrieved Information'].Parameters.FunctionName = props.combineRetrievedInformationLambdaArn;
    }
  });

  parsedDefinition.States['Generate Final Prompt'].Parameters.FunctionName = props.generateFinalPromptLambdaArn;
  parsedDefinition.States['Get Final Result from Bedrock'].Parameters.ModelId = props.finalResultModelARN;
  parsedDefinition.States['Get Final Result from Bedrock'].Parameters.Input.S3Uri = `s3://${props.inputS3BucketName}/${props.inputS3BucketFinalPromptKey}`;

  return parsedDefinition;
} 