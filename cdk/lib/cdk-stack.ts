import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigw from "aws-cdk-lib/aws-apigateway";

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const siteBucket = new s3.Bucket(this, "bucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      accessControl: s3.BucketAccessControl.PUBLIC_READ,
      publicReadAccess: true,
      websiteIndexDocument: "index.html",
    });

    const deployment = new s3deploy.BucketDeployment(this, "deployment", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../website"))],
      destinationBucket: siteBucket,
    });

    const gateway = new apigw.LambdaRestApi(this, "gateway", {
      handler: new lambda.Function(this, "function", {
        runtime: lambda.Runtime.NODEJS_16_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset(path.join(__dirname, "../../function")),
      }),
    });

    new cdk.CfnOutput(this, "websiteEndpoint", {
      value: siteBucket.bucketWebsiteUrl,
    });
    new cdk.CfnOutput(this, "apiEndpoint", {
      value: gateway.url,
    });
  }
}
