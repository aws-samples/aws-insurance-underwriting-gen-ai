import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export interface EventBridgeProps extends cdk.StackProps {
  readonly stepFunction: cdk.aws_stepfunctions.CfnStateMachine;
  readonly bucketName: string;
}

const defaultProps: Partial<EventBridgeProps> = {};

export class EventBridgeConstruct extends Construct {

  constructor(scope: Construct, name: string, props: EventBridgeProps) {
    super(scope, name);

    props = { ...defaultProps, ...props };

    new cdk.aws_events.Rule(this, "ExecuteStepFunctionAfterFileUploadRule", {
      ruleName: "ExecuteStepFunctionAfterFileUploadRule",
      description: "Rule to invoke AWS Step Function flow after a file is uploaded into S3 bucket.",
      eventPattern: {
        source: ["aws.s3"],
        detailType: ["Object Created"],
        detail: {   
            "bucket": {
                "name": [`${props.bucketName}`]
            },
        },
      },
      targets: [
        new cdk.aws_events_targets.SfnStateMachine(
          cdk.aws_stepfunctions.StateMachine.fromStateMachineArn(this, 'StateMachineTarget', props.stepFunction.ref) 
          )
      ]
    });
  }
}