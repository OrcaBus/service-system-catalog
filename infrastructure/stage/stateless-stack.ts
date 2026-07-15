import * as path from 'path';
import { Construct } from 'constructs';
import { Duration, RemovalPolicy, StackProps } from 'aws-cdk-lib';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { APP_ROOT, REPO_ROOT } from './constants';
import { ISecurityGroup, IVpc, SecurityGroup, Vpc, VpcLookupOptions } from 'aws-cdk-lib/aws-ec2';
import {
  OrcaBusApiGateway,
  OrcaBusApiGatewayProps,
} from '@orcabus/platform-cdk-constructs/api-gateway';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import {
  HttpMethod,
  HttpNoneAuthorizer,
  HttpRoute,
  HttpRouteKey,
} from 'aws-cdk-lib/aws-apigatewayv2';
import { GitStack } from '@orcabus/platform-cdk-constructs/deployment-stack-pipeline';

export interface SystemCatalogStatelessStackProps extends StackProps {
  lambdaSecurityGroupName: string;
  vpcProps: VpcLookupOptions;
  apiGatewayCognitoProps: OrcaBusApiGatewayProps;
  dynamoDBTableName: string;
}

export class SystemCatalogStatelessStack extends GitStack {
  private readonly lambdaEnv: Record<string, string>;
  private readonly lambdaRole: Role;
  private readonly lambdaSG: ISecurityGroup;
  private readonly vpc: IVpc;

  constructor(scope: Construct, id: string, props: SystemCatalogStatelessStackProps) {
    super(scope, id, props);

    this.vpc = Vpc.fromLookup(this, 'MainVpc', props.vpcProps);
    this.lambdaSG = SecurityGroup.fromLookupByName(
      this,
      'LambdaSecurityGroup',
      props.lambdaSecurityGroupName,
      this.vpc
    );

    this.lambdaRole = new Role(this, 'LambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      description: 'Lambda execution role for ' + id,
    });

    this.lambdaRole.addToPolicy(
      new PolicyStatement({
        actions: [
          'ec2:CreateNetworkInterface',
          'ec2:DescribeNetworkInterfaces',
          'ec2:DescribeSecurityGroups',
          'ec2:DescribeSubnets',
          'ec2:DescribeVpcs',
          'ec2:DeleteNetworkInterface',
          'ec2:AssignPrivateIpAddresses',
          'ec2:UnassignPrivateIpAddresses',
        ],
        resources: ['*'],
      })
    );

    this.lambdaEnv = {
      NODE_ENV: 'production',
      DYNAMODB_TABLE_NAME: props.dynamoDBTableName,
      DEFAULT_ACTOR: 'system-catalog@orcabus',
      OPENAPI_SPEC_PATH: '/var/task/schema/openapi.yaml',
      CORS_ALLOW_ORIGINS: props.apiGatewayCognitoProps.corsAllowOrigins.join(','),
    };

    this.createApiHandlerAndIntegration(props);
  }

  private createLambdaFunction(id: string): NodejsFunction {
    const logGroup = new LogGroup(this, 'ApiHandlerLogGroup', {
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.lambdaRole.addToPolicy(
      new PolicyStatement({
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [logGroup.logGroupArn, `${logGroup.logGroupArn}:*`],
      })
    );

    return new NodejsFunction(this, id, {
      entry: path.join(APP_ROOT, 'src/lambda.ts'),
      handler: 'handler',
      depsLockFilePath: path.join(REPO_ROOT, 'pnpm-lock.yaml'),
      projectRoot: REPO_ROOT,
      bundling: {
        tsconfig: path.join(APP_ROOT, 'tsconfig.json'),
        target: 'node24',
        sourceMap: true,
        commandHooks: {
          beforeBundling(): string[] {
            return [];
          },
          beforeInstall(): string[] {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            return [
              `mkdir -p ${outputDir}/schema`,
              `cp ${inputDir}/app/schema/openapi.yaml ${outputDir}/schema/openapi.yaml`,
            ];
          },
        },
      },
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      role: this.lambdaRole,
      securityGroups: [this.lambdaSG],
      vpc: this.vpc,
      environment: this.lambdaEnv,
      logGroup,
      timeout: Duration.seconds(30),
    });
  }

  private createApiHandlerAndIntegration(props: SystemCatalogStatelessStackProps) {
    const table = Table.fromTableAttributes(this, 'SystemCatalogTable', {
      tableName: props.dynamoDBTableName,
      globalIndexes: ['MapsByUpdatedAt', 'StatusIndex'],
    });

    const lambdaFunction = this.createLambdaFunction('ApiHandler');
    table.grantReadWriteData(lambdaFunction);

    const scApi = new OrcaBusApiGateway(this, 'ApiGateway', props.apiGatewayCognitoProps);
    const httpApi = scApi.httpApi;

    const apiIntegration = new HttpLambdaIntegration('ApiIntegration', lambdaFunction);
    const publicAuthorizer = new HttpNoneAuthorizer();

    new HttpRoute(this, 'GetRootHttpRoute', {
      httpApi,
      integration: apiIntegration,
      authorizer: publicAuthorizer,
      routeKey: HttpRouteKey.with('/', HttpMethod.GET),
    });

    new HttpRoute(this, 'GetHealthHttpRoute', {
      httpApi,
      integration: apiIntegration,
      authorizer: publicAuthorizer,
      routeKey: HttpRouteKey.with('/health', HttpMethod.GET),
    });

    new HttpRoute(this, 'GetSchemaHttpRoute', {
      httpApi,
      integration: apiIntegration,
      authorizer: publicAuthorizer,
      routeKey: HttpRouteKey.with('/schema/{proxy+}', HttpMethod.GET),
    });

    // The HTTP API applies a default Cognito JWT authorizer to routed methods.
    // If this proxy were `ANY`, preflight `OPTIONS` would be routed and hit the
    // authorizer. Browsers do not send Authorization on preflight, so that
    // request would fail before the actual API call.
    // Register concrete methods only so `OPTIONS` stays unrouted and is handled
    // by API Gateway `corsPreflight`, while the real API verbs stay protected.
    const protectedMethods = [
      HttpMethod.GET,
      HttpMethod.POST,
      HttpMethod.PUT,
      HttpMethod.PATCH,
      HttpMethod.DELETE,
    ];

    for (const method of protectedMethods) {
      new HttpRoute(this, `ApiProxy${method}HttpRoute`, {
        httpApi,
        integration: apiIntegration,
        routeKey: HttpRouteKey.with('/api/{proxy+}', method),
      });
    }
  }
}
