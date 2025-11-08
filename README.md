# OP: Simple Web Application using IaC

This project was created as part of the OP Kiitorata program technical assignment.

The goal is to implement and deploy a Simple Web Application using Infrastructure as Code (IaC)

## Overview:
The application consists of three main parts:
- Frontend: built with TypeScript, React, and Vite
- Backend: implemented using Fastify, running as an AWS Lambda function function built from a custom Dockerfile
- Infrastructure: defined in TypeScript using AWS CDK to set up several services on AWS:
  - AWS Lambda (runs the backend inside the Docker container)
  - S3 buckets (store static website assets and images)
  - CloudFront (for global content delivery)

## Prerequisites:
In order to deploy the program you're going to need: Node.js and npm, AWS CLI, AWS CDK and Docker Desktop (for iOS/Windows deployment)

Installing Node.js might require sudo rights. On Linux the commands are:
```apt install nodejs``` and ```apt install npm```

1. Clone the repository:
```git clone https://github.com/huskyhania/OP-Web-Application-IaC```
2. Go to infra directory:
```cd infra```
3. Install the necessary node modules:
```npm install```
4. Install aws-cli and cdk:
```install aws-cli``` and ```install cdk```
5. Configure aws account (you need an account on AWS platform).
```aws configure```
During configuration, you’ll need your AWS Access Key ID, Secret Access Key, and region.
7. If you're using iOS or Windows, download Docker Desktop and start it before continuing
8. Bootstrap AWS account:
```cdk bootstrap```
You will get prompted for account id and region. Bootstrapping only needs to be done once per AWS environment.
9. Start Docker Desktop if you’re on macOS or Windows (optional step).
10. Last step is deployment of the stack:
```cdk deploy```
11. To destroy the infrastrucre:
```cdk destroy```

## Additional information
Make sure your AWS account has the necessary permissions for CloudFormation, S3, Lambda, and CloudFront.
Bootstrapping (```cdk bootstrap```) only needs to be done once per AWS environment.

## Limitations and next steps
This project successfully deploys a full-stack web application using AWS CDK, but several parts remain simplified due to limited time and experience with cloud technologies.

No CI/CD pipeline: Deployment is done manually using ```cdk deploy```. In a real-world scenario, this would be automated using GitHub Actions or AWS CodePipeline.

Limited backend: The Lambda function serves as a minimal proof of concept. It could be extended with additional routes, better error handling, and a database connection.

Security and monitoring: The setup does not yet include CloudWatch logging, detailed IAM role restrictions, or HTTPS certificates.
