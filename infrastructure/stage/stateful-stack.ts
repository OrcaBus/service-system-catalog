import { Construct } from 'constructs';
import { StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { AttributeType, BillingMode, ProjectionType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { GitStack } from '@orcabus/platform-cdk-constructs/deployment-stack-pipeline';

export interface SystemCatalogStatefulStackProps extends StackProps {
  tableName: string;
  removalPolicy?: RemovalPolicy;
  deletionProtection?: boolean;
}

const MAP_SUMMARY_ATTRIBUTES = [
  'mapId',
  'name',
  'description',
  'status',
  'version',
  'isDeleted',
  'createdBy',
  'createdAt',
  'updatedBy',
  'updatedAt',
  'tags',
  'nodeCount',
  'edgeCount',
];

export class SystemCatalogStatefulStack extends GitStack {
  constructor(scope: Construct, id: string, props: SystemCatalogStatefulStackProps) {
    super(scope, id, props);

    const table = new Table(this, 'SystemCatalogTable', {
      tableName: props.tableName,
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      sortKey: { name: 'SK', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      deletionProtection: props.deletionProtection ?? false,
      removalPolicy: props.removalPolicy ?? RemovalPolicy.DESTROY,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'MapsByUpdatedAt',
      partitionKey: { name: 'GSI1PK', type: AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: AttributeType.STRING },
      projectionType: ProjectionType.INCLUDE,
      nonKeyAttributes: MAP_SUMMARY_ATTRIBUTES,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'GSI2PK', type: AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: AttributeType.STRING },
      projectionType: ProjectionType.INCLUDE,
      nonKeyAttributes: MAP_SUMMARY_ATTRIBUTES,
    });
  }
}
