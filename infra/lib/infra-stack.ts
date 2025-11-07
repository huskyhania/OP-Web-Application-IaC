import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwInt from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";

import { execSync } from "child_process";

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    execSync("npm ci && npm run build", {
      cwd: path.join(__dirname, "../../frontend"),
      stdio: "inherit",
    });

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

    // --- Deploy prebuilt frontend to S3 ---
    new s3deploy.BucketDeployment(this, "DeployFrontend", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../frontend/dist"))],
      destinationBucket: siteBucket,
    });

    // --- CloudFront distribution ---
    const distribution = new cloudfront.Distribution(this, "SiteDistribution", {
      defaultBehavior: {
        origin: new origins.S3Origin(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        "/api/*": {
          origin: new origins.HttpOrigin(
            // Extract domain from API Gateway URL (e.g., https://xxxx.execute-api.region.amazonaws.com)
            cdk.Fn.select(2, cdk.Fn.split("/", api.apiEndpoint))
          ),
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      },
      defaultRootObject: "index.html",
    });

    // --- Outputs ---
    new cdk.CfnOutput(this, "FrontendURL", {
      value: siteBucket.bucketWebsiteUrl,
    });

    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: api.apiEndpoint,
    });

    new cdk.CfnOutput(this, "CloudFrontURL", {
      value: "https://" + distribution.distributionDomainName,
    });
  }
}
