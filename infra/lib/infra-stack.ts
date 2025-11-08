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
import * as iam from "aws-cdk-lib/aws-iam";
import { execSync } from "child_process";

/* Full-stack application infrastructure (InfraStack),
 * supporting both /fortune and /photo routes.
 */
export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    execSync("npm ci && npm run build", {
      cwd: path.join(__dirname, "../../frontend"),
      stdio: "inherit",
    });

    const siteBucket = new s3.Bucket(this, "FrontendBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const photoBucket = new s3.Bucket(this, "PhotoBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    new s3deploy.BucketDeployment(this, "PhotoDeployment", {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, "assets")),
      ],
      destinationBucket: photoBucket,
      destinationKeyPrefix: '',
      prune: false,
      include: ['profile.png'], 
    });


    // Lambda backend with Fastify
    const backendFn = new lambdaNodejs.NodejsFunction(this, "BackendFn", {
      entry: path.join(__dirname, "../../backend/srcs/index.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        PHOTO_BUCKET: photoBucket.bucketName,
        PHOTO_KEY: 'profile.jpg', 
      },
      depsLockFilePath: path.join(__dirname, "../../backend/package-lock.json"),
      projectRoot: path.join(__dirname, "../../backend"),
      timeout: cdk.Duration.seconds(10), 
    });
    
    // Permissions for Lambda to use photo bucket
    photoBucket.grantRead(backendFn);


    //API Gateway
    const api = new apigwv2.HttpApi(this, "HttpApi", {
      defaultIntegration: new apigwInt.HttpLambdaIntegration(
        "DefaultLambdaIntegration",
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

    api.addRoutes({
      path: "/fortune",
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwInt.HttpLambdaIntegration("FortuneIntegration", backendFn),
    });
    
    api.addRoutes({
      path: "/photo",
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwInt.HttpLambdaIntegration("PhotoIntegration", backendFn),
    });

    // CloudFront Origin Access Identity (OAI) for S3 access
    const oai = new cloudfront.OriginAccessIdentity(this, "SiteOAI");
    siteBucket.grantRead(oai);

    /* Private bucket fix
    Custom Origin Request Policy to prevent 403 Forbidden
    Eensures the Host header (which CloudFront sets to its own domain) 
    is NOT forwarded to the API Gateway domain, which expects its own unique host*/
    const apiRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'ApiForwardingPolicy', {
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
          'Origin',
          'Content-Type',
          'Access-Control-Request-Method',
          'Access-Control-Request-Headers'
      ), 
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(), 
      comment: 'Policy to forward minimal headers to API Gateway (excludes Host)',
  });

    // Cloudfront, extracting the API Gateway domain name from the full URL string
    const apiDomain = cdk.Fn.select(2, cdk.Fn.split('/', api.url!)); 

    const distribution = new cloudfront.Distribution(this, "SiteDistribution", {
      defaultRootObject: "index.html",
    
      defaultBehavior: {
        origin: new origins.S3Origin(siteBucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    
      additionalBehaviors: {
        "/fortune*": { 
          origin: new origins.HttpOrigin(apiDomain, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: apiRequestPolicy, // THE FIX
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        "/photo*": { 
          origin: new origins.HttpOrigin(apiDomain, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: apiRequestPolicy, // THE FIX
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      },
    
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(1),
        },
      ],
    });

    new s3deploy.BucketDeployment(this, "DeployFrontend", {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, "../../frontend/dist")),
      ],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ["/*"],
    });

    // Informative outputs
    new cdk.CfnOutput(this, "CloudFrontURL", {
      value: `https://${distribution.domainName}`,
    });
    new cdk.CfnOutput(this, "ApiEndpoint", { value: api.url! }); 
    new cdk.CfnOutput(this, "PhotoBucketName", { value: photoBucket.bucketName });
  }
}