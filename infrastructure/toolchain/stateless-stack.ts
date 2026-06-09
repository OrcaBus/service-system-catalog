import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DeploymentStackPipeline } from '@orcabus/platform-cdk-constructs/deployment-stack-pipeline';
import { getSystemCatalogStatelessStackProps } from '../stage/config';
import { SystemCatalogStatelessStack } from '../stage/stateless-stack';
import { node24PartialBuildSpec } from './build-spec';

export class StatelessStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new DeploymentStackPipeline(this, 'DeploymentPipeline', {
      githubBranch: 'main',
      githubRepo: 'service-system-catalog',
      excludedFilePaths: [
        'infrastructure/stage/stateful-stack.ts',
        'infrastructure/toolchain/stateful-stack.ts',
        'docs/**',
      ],
      stack: SystemCatalogStatelessStack,
      stackName: 'SystemCatalogStatelessStack',
      stackConfig: {
        beta: getSystemCatalogStatelessStackProps('BETA'),
        gamma: getSystemCatalogStatelessStackProps('GAMMA'),
        prod: getSystemCatalogStatelessStackProps('PROD'),
      },
      pipelineName: 'OrcaBus-SystemCatalogStatelessStack',
      cdkSynthCmd: ['pnpm install --frozen-lockfile --ignore-scripts', 'pnpm cdk-stateless synth'],
      synthBuildSpec: node24PartialBuildSpec(),
      unitAppTestConfig: {
        command: ['cd app && make install && make check && make test'],
        partialBuildSpec: node24PartialBuildSpec(),
      },
      unitIacTestConfig: {
        command: ['pnpm test'],
        partialBuildSpec: node24PartialBuildSpec(),
      },
    });
  }
}
