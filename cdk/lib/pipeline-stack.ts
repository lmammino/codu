import * as cdk from "aws-cdk-lib";
import type { Construct } from "constructs";
import { AppStage } from "./app-stage";
import {
  CodePipeline,
  CodePipelineSource,
  ShellStep,
} from "aws-cdk-lib/pipelines";
import * as ssm from "aws-cdk-lib/aws-ssm";

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    const synthAction = new ShellStep("Synth", {
      input: CodePipelineSource.gitHub("codu-code/codu", "develop"),
      commands: ["cd cdk", "npm ci", "npm run build", "npx cdk synth"],
      primaryOutputDirectory: "cdk/cdk.out",
    });

    const pipeline = new CodePipeline(this, "Pipeline", {
      pipelineName: "codu-pipline",
      crossAccountKeys: true,
      synth: synthAction,
    });

    const getConfig = (env: "dev" | "prod") => {
      const accountId = ssm.StringParameter.valueFromLookup(
        this,
        `/env/${env}/accountId`
      );

      return {
        env: {
          account: accountId,
          region: "eu-west-1",
        },
      };
    };

    const dev = new AppStage(this, "Dev", getConfig("dev"));

    const prod = new AppStage(this, "Prod", {
      ...getConfig("prod"),
      production: true,
    });

    pipeline.addStage(dev);
    pipeline.addStage(prod, {
      pre: [new cdk.pipelines.ManualApprovalStep("Deploy to production")],
    });
  }
}
