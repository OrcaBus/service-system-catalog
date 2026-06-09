import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DeploymentStackPipeline } from '@orcabus/platform-cdk-constructs/deployment-stack-pipeline';
import { getSystemCatalogStatefulStackProps } from '../stage/config';
import { SystemCatalogStatefulStack } from '../stage/stateful-stack';
import { node24PartialBuildSpec } from './build-spec';

export class StatefulStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new DeploymentStackPipeline(this, 'DeploymentPipeline', {
      githubBranch: 'main',
      githubRepo: 'service-system-catalog',
      excludedFilePaths: [
        'app/**',
        'docs/**',
        'infrastructure/stage/stateless-stack.ts',
        'infrastructure/toolchain/stateless-stack.ts',
      ],
      stack: SystemCatalogStatefulStack,
      stackName: 'SystemCatalogStatefulStack',
      stackConfig: {
        beta: getSystemCatalogStatefulStackProps('BETA'),
        gamma: getSystemCatalogStatefulStackProps('GAMMA'),
        prod: getSystemCatalogStatefulStackProps('PROD'),
      },
      pipelineName: 'OrcaBus-SystemCatalogStatefulStack',
      cdkSynthCmd: ['pnpm install --frozen-lockfile --ignore-scripts', 'pnpm cdk-stateful synth'],
      synthBuildSpec: node24PartialBuildSpec(),
      // No app tests for stateful stack.
      unitAppTestConfig: {
        command: [],
        partialBuildSpec: node24PartialBuildSpec(),
      },
      unitIacTestConfig: {
        command: ['pnpm test'],
        partialBuildSpec: node24PartialBuildSpec(),
      },
    });
  }
}
