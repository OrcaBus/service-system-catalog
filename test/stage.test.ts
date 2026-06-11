import { App, Aspects, RemovalPolicy } from 'aws-cdk-lib';
import { Match, Template, Annotations } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { getSystemCatalogStatefulStackProps } from '../infrastructure/stage/config';
import { SystemCatalogStatefulStack } from '../infrastructure/stage/stateful-stack';
import { SystemCatalogStatelessStack } from '../infrastructure/stage/stateless-stack';
import { synthesisMessageToString } from './utils';

const TEST_ACCOUNT = '111111111111';
const TEST_REGION = 'ap-southeast-2';
const TEST_VPC_ID = 'vpc-1234567890abcdef0';
const TEST_SECURITY_GROUP_ID = 'sg-1234567890abcdef0';
const TEST_SECURITY_GROUP_NAME = 'shared-security-group';
const TEST_VPC_NAME = 'shared-vpc';
const TEST_VPC_LOOKUP_CONTEXT_KEY = [
  'vpc-provider',
  `account=${TEST_ACCOUNT}`,
  `filter.tag$:Name=${TEST_VPC_NAME}`,
  `region=${TEST_REGION}`,
  'returnAsymmetricSubnets=true',
].join(':');
const TEST_SECURITY_GROUP_LOOKUP_CONTEXT_KEY = [
  'security-group-provider',
  `account=${TEST_ACCOUNT}`,
  `region=${TEST_REGION}`,
  `securityGroupName=${TEST_SECURITY_GROUP_NAME}`,
  `vpcId=${TEST_VPC_ID}`,
].join(':');

function appWithLookupContext(): App {
  return new App({
    context: {
      [TEST_VPC_LOOKUP_CONTEXT_KEY]: {
        vpcId: TEST_VPC_ID,
        vpcCidrBlock: '10.0.0.0/16',
        ownerAccountId: TEST_ACCOUNT,
        subnetGroups: [
          {
            name: 'Private',
            type: 'Private',
            subnets: [
              {
                availabilityZone: `${TEST_REGION}a`,
                subnetId: 'subnet-11111111111111111',
                routeTableId: 'rtb-11111111111111111',
                cidr: '10.0.1.0/24',
              },
              {
                availabilityZone: `${TEST_REGION}b`,
                subnetId: 'subnet-22222222222222222',
                routeTableId: 'rtb-22222222222222222',
                cidr: '10.0.2.0/24',
              },
            ],
          },
        ],
      },
      [TEST_SECURITY_GROUP_LOOKUP_CONTEXT_KEY]: {
        securityGroupId: TEST_SECURITY_GROUP_ID,
        allowAllOutbound: true,
      },
    },
  });
}

describe('system-catalog-stateful-stack', () => {
  const app = new App({});
  const stack = new SystemCatalogStatefulStack(app, 'SystemCatalogStatefulStack', {
    ...getSystemCatalogStatefulStackProps('BETA'),
    env: {
      account: TEST_ACCOUNT,
      region: TEST_REGION,
    },
  });

  Aspects.of(stack).add(new AwsSolutionsChecks());
  const template = Template.fromStack(stack);

  test('creates the table schema used by the app repository', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [
        {
          AttributeName: 'PK',
          KeyType: 'HASH',
        },
        {
          AttributeName: 'SK',
          KeyType: 'RANGE',
        },
      ],
      PointInTimeRecoverySpecification: {
        PointInTimeRecoveryEnabled: true,
      },
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: 'MapsByUpdatedAt',
          KeySchema: [
            {
              AttributeName: 'GSI1PK',
              KeyType: 'HASH',
            },
            {
              AttributeName: 'GSI1SK',
              KeyType: 'RANGE',
            },
          ],
          Projection: {
            ProjectionType: 'INCLUDE',
            NonKeyAttributes: Match.arrayWith(['mapId', 'name', 'status', 'updatedAt']),
          },
        }),
        Match.objectLike({
          IndexName: 'StatusIndex',
          KeySchema: [
            {
              AttributeName: 'GSI2PK',
              KeyType: 'HASH',
            },
            {
              AttributeName: 'GSI2SK',
              KeyType: 'RANGE',
            },
          ],
          Projection: {
            ProjectionType: 'INCLUDE',
            NonKeyAttributes: Match.arrayWith(['mapId', 'name', 'status', 'updatedAt']),
          },
        }),
      ]),
    });
  });

  test('uses retain and deletion protection for prod config', () => {
    expect(getSystemCatalogStatefulStackProps('PROD')).toMatchObject({
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
      tableName: 'SystemCatalogTable-PROD',
    });
  });

  test('cdk-nag AwsSolutions Pack errors', () => {
    const errors = Annotations.fromStack(stack)
      .findError('*', Match.stringLikeRegexp('AwsSolutions-.*'))
      .map(synthesisMessageToString);
    expect(errors).toHaveLength(0);
  });

  test('cdk-nag AwsSolutions Pack warnings', () => {
    const warnings = Annotations.fromStack(stack)
      .findWarning('*', Match.stringLikeRegexp('AwsSolutions-.*'))
      .map(synthesisMessageToString);
    expect(warnings).toHaveLength(0);
  });
});

describe('system-catalog-stateless-stack', () => {
  const app = appWithLookupContext();
  const stack = new SystemCatalogStatelessStack(app, 'SystemCatalogStatelessStack', {
    env: {
      account: TEST_ACCOUNT,
      region: TEST_REGION,
    },
    lambdaSecurityGroupName: TEST_SECURITY_GROUP_NAME,
    vpcProps: {
      vpcName: TEST_VPC_NAME,
    },
    apiGatewayCognitoProps: {
      apiName: 'SystemCatalogApi',
      customDomainNamePrefix: 'system-catalog',
      cognitoClientIdParameterNameArray: ['/test/cognito/client-id'],
      corsAllowOrigins: ['https://example.test'],
      apiGwLogsConfig: {
        retention: 30,
        removalPolicy: RemovalPolicy.DESTROY,
      },
    },
    dynamoDBTableName: 'SystemCatalogTable-BETA',
  });

  Aspects.of(stack).add(new AwsSolutionsChecks());
  NagSuppressions.addStackSuppressions(
    stack,
    [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Lambda VPC ENI permissions and DynamoDB index grants require wildcard resources.',
      },
      {
        id: 'AwsSolutions-APIG4',
        reason: 'Root, health, and schema routes are intentionally public.',
      },
      {
        id: 'AwsSolutions-COG4',
        reason: 'Root, health, and schema routes are intentionally public.',
      },
    ],
    true
  );
  const template = Template.fromStack(stack);

  test('creates a Node.js Hono Lambda with production environment', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs24.x',
      Architectures: ['arm64'],
      Handler: 'index.handler',
      Environment: {
        Variables: Match.objectLike({
          NODE_ENV: 'production',
          DYNAMODB_TABLE_NAME: 'SystemCatalogTable-BETA',
          DEFAULT_ACTOR: 'system-catalog@orcabus',
          OPENAPI_SPEC_PATH: '/var/task/schema/openapi.yaml',
          CORS_ALLOW_ORIGINS: 'https://example.test',
        }),
      },
    });
  });

  test('routes public docs and protected API proxy traffic', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'GET /schema/{proxy+}',
      AuthorizationType: 'NONE',
    });
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'GET /health',
      AuthorizationType: 'NONE',
    });
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'ANY /api/{proxy+}',
    });
  });

  test('grants the Lambda DynamoDB access to the table and indexes', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(['dynamodb:GetItem', 'dynamodb:PutItem']),
            Resource: Match.arrayWith([
              {
                'Fn::Join': Match.arrayWith([
                  Match.arrayWith([Match.stringLikeRegexp('table/SystemCatalogTable-BETA')]),
                ]),
              },
              {
                'Fn::Join': Match.arrayWith([
                  Match.arrayWith([Match.stringLikeRegexp('table/SystemCatalogTable-BETA/index')]),
                ]),
              },
            ]),
          }),
        ]),
      },
    });
  });

  test('grants the Lambda permissions required for VPC ENIs', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith([
              'ec2:CreateNetworkInterface',
              'ec2:DescribeNetworkInterfaces',
              'ec2:DescribeSecurityGroups',
              'ec2:DescribeSubnets',
              'ec2:DescribeVpcs',
              'ec2:DeleteNetworkInterface',
              'ec2:AssignPrivateIpAddresses',
              'ec2:UnassignPrivateIpAddresses',
            ]),
            Resource: '*',
          }),
        ]),
      },
    });
  });

  test('cdk-nag AwsSolutions Pack errors', () => {
    const errors = Annotations.fromStack(stack)
      .findError('*', Match.stringLikeRegexp('AwsSolutions-.*'))
      .map(synthesisMessageToString);
    expect(errors).toHaveLength(0);
  });

  test('cdk-nag AwsSolutions Pack warnings', () => {
    const warnings = Annotations.fromStack(stack)
      .findWarning('*', Match.stringLikeRegexp('AwsSolutions-.*'))
      .map(synthesisMessageToString);
    expect(warnings).toHaveLength(0);
  });
});
