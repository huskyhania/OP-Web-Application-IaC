import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwInt from "aws-cdk-lib/aws-apigatewayv2-integrations";

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const siteBucket = new s3.Bucket(this, "FrontendBucket", {
      websiteIndexDocument: "index.html",
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        ignorePublicAcls: false,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const backendFn = new lambdaNodejs.NodejsFunction(this, "BackendFn", {
      entry: path.join(__dirname, "../../backend/srcs/index.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      bundling: {
        forceDockerBundling: true,
        platform: "linux/amd64",
      },
      depsLockFilePath: path.join(__dirname, "../../backend/package-lock.json"),
      projectRoot: path.join(__dirname, "../../backend"),
    });

    const api = new apigwv2.HttpApi(this, "HttpApi", {
      defaultIntegration: new apigwInt.HttpLambdaIntegration(
        "LambdaIntegration",
        backendFn
      ),
      corsPreflight: {
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ["*"],
      },
    });

    // --- Upload prebuilt frontend ---
    new s3deploy.BucketDeployment(this, "DeployFrontend", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../frontend/dist"))],
      destinationBucket: siteBucket,
    });

    new cdk.CfnOutput(this, "FrontendURL", {
      value: siteBucket.bucketWebsiteUrl,
    });

    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: api.apiEndpoint,
    });
  }
}
