import { StageName } from '@orcabus/platform-cdk-constructs/shared-config/accounts';
import { SystemCatalogStatefulStackProps } from './stateful-stack';
import { SystemCatalogStatelessStackProps } from './stateless-stack';
import { getDefaultApiGatewayConfiguration } from '@orcabus/platform-cdk-constructs/api-gateway';
import {
  SHARED_SECURITY_GROUP_NAME,
  VPC_LOOKUP_PROPS,
} from '@orcabus/platform-cdk-constructs/shared-config/networking';
import { RemovalPolicy } from 'aws-cdk-lib';

export const getSystemCatalogStatelessStackProps = (
  stage: StageName
): SystemCatalogStatelessStackProps => {
  return {
    vpcProps: VPC_LOOKUP_PROPS,
    lambdaSecurityGroupName: SHARED_SECURITY_GROUP_NAME,
    apiGatewayCognitoProps: {
      ...getDefaultApiGatewayConfiguration(stage),
      apiName: 'SystemCatalogApi',
      customDomainNamePrefix: 'system-catalog',
      corsAllowHeaders: ['if-match'],
      corsExposeHeaders: ['ETag'],
    },
    dynamoDBTableName: `SystemCatalogTable-${stage}`,
  };
};

export const getSystemCatalogStatefulStackProps = (
  stage: StageName
): SystemCatalogStatefulStackProps => {
  const isProd = stage === 'PROD';

  return {
    tableName: `SystemCatalogTable-${stage}`,
    // Point-in-time recovery is enabled in every stage: it protects the catalog data,
    // satisfies cdk-nag AwsSolutions-DDB3, and (unlike deletionProtection/removalPolicy)
    // does not block tearing down non-prod stacks.
    pointInTimeRecoveryEnabled: true,
    deletionProtection: isProd,
    removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
  };
};
