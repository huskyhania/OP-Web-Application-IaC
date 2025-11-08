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

/**
 * Defines the entire full-stack application infrastructure (InfraStack),
 * supporting both /fortune and /photo routes.
 */
export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- 1️⃣ Build frontend (pre-deployment step) ---
    // NOTE: This assumes you have a 'frontend' directory adjacent to your 'cdk_stack' directory.
    execSync("npm ci && npm run build", {
      cwd: path.join(__dirname, "../../frontend"),
      stdio: "inherit",
    });

    // --- 2️⃣ S3 bucket for frontend (Static Assets) ---
    const siteBucket = new s3.Bucket(this, "FrontendBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // --- 3️⃣ S3 bucket for photos (Backend Resource) ---
    const photoBucket = new s3.Bucket(this, "PhotoBucket", {
      // Must be private since the Lambda will generate signed URLs for access
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });


    // --- 4️⃣ Lambda backend (Fastify Handler) ---
    const backendFn = new lambdaNodejs.NodejsFunction(this, "BackendFn", {
      entry: path.join(__dirname, "../../backend/srcs/index.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      // Provide environment variables needed by the Fastify code (for S3 client)
      environment: {
        PHOTO_BUCKET: photoBucket.bucketName,
        // Using a static key for testing.
        PHOTO_KEY: 'test-photo.png', 
      },
      // Ensure the bundler knows where to find the lock file and project root
      depsLockFilePath: path.join(__dirname, "../../backend/package-lock.json"),
      projectRoot: path.join(__dirname, "../../backend"),
      timeout: cdk.Duration.seconds(10), 
    });
    
    // --- 5️⃣ IAM Permissions: Grant Lambda read access to the photo bucket ---
    // This is required for getSignedUrl(GetObjectCommand) in your backend.
    photoBucket.grantRead(backendFn);


    // --- 6️⃣ API Gateway (HTTP API) ---
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

    // Define the /fortune route
    api.addRoutes({
      path: "/fortune",
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwInt.HttpLambdaIntegration("FortuneIntegration", backendFn),
    });
    
    // Define the /photo route
    api.addRoutes({
      path: "/photo",
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwInt.HttpLambdaIntegration("PhotoIntegration", backendFn),
    });

    // --- 7️⃣ CloudFront Origin Access Identity (OAI) for S3 access ---
    const oai = new cloudfront.OriginAccessIdentity(this, "SiteOAI");
    siteBucket.grantRead(oai);

    // --- CRITICAL FIX: Custom Origin Request Policy to prevent 403 Forbidden ---
    // This policy ensures the Host header (which CloudFront sets to its own domain) 
    // is NOT forwarded to the API Gateway domain, which expects its own unique host.
    const apiRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'ApiForwardingPolicy', {
      // FIX: Explicitly allow necessary headers. This implicitly excludes 'Host'.
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
          'Origin',
          'Content-Type', // Essential for POST/data
          'Access-Control-Request-Method',
          'Access-Control-Request-Headers'
      ), 
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(), 
      comment: 'Policy to forward minimal headers to API Gateway (excludes Host)',
  });


    // --- 8️⃣ CloudFront distribution ---
    // Extract the API Gateway domain name from the full URL string
    const apiDomain = cdk.Fn.select(2, cdk.Fn.split('/', api.url!)); 

    const distribution = new cloudfront.Distribution(this, "SiteDistribution", {
      defaultRootObject: "index.html",
    
      // --- Static frontend (S3 origin) ---
      defaultBehavior: {
        origin: new origins.S3Origin(siteBucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    
      // --- API Gateway behaviors (Applied to both routes) ---
      additionalBehaviors: {
        // Route requests matching /fortune (and any query params)
        "/fortune*": { 
          origin: new origins.HttpOrigin(apiDomain, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: apiRequestPolicy, // THE FIX
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        // Route requests matching /photo
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
    
      // --- SPA fallback for client-side routing ---
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(1),
        },
      ],
    });

    // --- 9️⃣ Deploy frontend ---
    new s3deploy.BucketDeployment(this, "DeployFrontend", {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, "../../frontend/dist")),
      ],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ["/*"],
    });

    // --- 🔟 Outputs ---
    new cdk.CfnOutput(this, "CloudFrontURL", {
      value: `https://${distribution.domainName}`,
    });

    // api.url can be undefined, so we use the non-null assertion (!)
    new cdk.CfnOutput(this, "ApiEndpoint", { value: api.url! }); 
    new cdk.CfnOutput(this, "PhotoBucketName", { value: photoBucket.bucketName });
  }
}