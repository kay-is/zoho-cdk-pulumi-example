import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const bucket = new aws.s3.Bucket("bucket", {
  acl: "public-read",
  website: { indexDocument: "index.html" },
});

new aws.s3.BucketPolicy("bucketPolicy", {
  bucket: bucket.bucket,
  policy: bucket.bucket.apply((name: string) =>
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: "*",
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${name}/*`],
        },
      ],
    })
  ),
});

new aws.s3.BucketObject("index.html", {
  bucket,
  source: new pulumi.asset.FileAsset("../website/index.html"),
  contentType: "text/html",
});

const role = new aws.iam.Role("role", {
  assumeRolePolicy: {
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Principal: { Service: "lambda.amazonaws.com" },
        Effect: "Allow",
        Sid: "",
      },
    ],
  },
});

new aws.iam.RolePolicyAttachment("roleAttachment", {
  role,
  policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
});

const lambda = new aws.lambda.Function("lambda", {
  role: role.arn,
  runtime: "nodejs16.x",
  handler: "index.handler",
  code: new pulumi.asset.AssetArchive({
    ".": new pulumi.asset.FileArchive("../function"),
  }),
});

const gateway = new aws.apigatewayv2.Api("gateway", { protocolType: "HTTP" });

new aws.lambda.Permission(
  "permission",
  {
    action: "lambda:InvokeFunction",
    principal: "apigateway.amazonaws.com",
    function: lambda,
    sourceArn: pulumi.interpolate`${gateway.executionArn}/*/*`,
  },
  { dependsOn: [gateway, lambda] }
);

const integration = new aws.apigatewayv2.Integration("integration", {
  apiId: gateway.id,
  integrationType: "AWS_PROXY",
  integrationUri: lambda.arn,
  integrationMethod: "POST",
  payloadFormatVersion: "2.0",
  passthroughBehavior: "WHEN_NO_MATCH",
});

const route = new aws.apigatewayv2.Route("route", {
  apiId: gateway.id,
  routeKey: "$default",
  target: pulumi.interpolate`integrations/${integration.id}`,
});

const stage = new aws.apigatewayv2.Stage(
  "stage",
  {
    apiId: gateway.id,
    name: pulumi.getStack(),
    routeSettings: [{ routeKey: route.routeKey }],
    autoDeploy: true,
  },
  { dependsOn: [route] }
);

export const websiteEndpoint = pulumi.interpolate`http://${bucket.websiteEndpoint}`;
export const apiEndpoint = pulumi.interpolate`${gateway.apiEndpoint}/${stage.name}`;
