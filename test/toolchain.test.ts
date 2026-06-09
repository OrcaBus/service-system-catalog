import { App, Aspects } from 'aws-cdk-lib';
import { Annotations, Match, Template } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { StatefulStack } from '../infrastructure/toolchain/stateful-stack';
import { synthesisMessageToString } from './utils';

type ParsedBuildSpec = {
  phases?: {
    install?: {
      'runtime-versions'?: {
        nodejs?: string;
      };
    };
  };
};

type NodeRuntimeBuildSpec = {
  phases: {
    install: {
      'runtime-versions': {
        nodejs?: string;
      };
    };
  };
};

function hasNodeRuntime(buildSpec: ParsedBuildSpec): buildSpec is NodeRuntimeBuildSpec {
  return buildSpec.phases?.install?.['runtime-versions'] !== undefined;
}

describe('cdk-nag-stateful-toolchain-stack', () => {
  const app = new App({});

  const stack = new StatefulStack(app, 'StatefulStack', {
    env: {
      account: '111111111111',
      region: 'ap-southeast-2',
    },
  });

  Aspects.of(stack).add(new AwsSolutionsChecks());

  NagSuppressions.addStackSuppressions(stack, [
    { id: 'AwsSolutions-IAM4', reason: 'Allow CDK Pipeline' },
    { id: 'AwsSolutions-IAM5', reason: 'Allow CDK Pipeline' },
    { id: 'AwsSolutions-S1', reason: 'Allow CDK Pipeline' },
    { id: 'AwsSolutions-KMS5', reason: 'Allow CDK Pipeline' },
    { id: 'AwsSolutions-CB3', reason: 'Allow CDK Pipeline' },
  ]);
  const template = Template.fromStack(stack);

  test(`cdk-nag AwsSolutions Pack errors`, () => {
    const errors = Annotations.fromStack(stack)
      .findError('*', Match.stringLikeRegexp('AwsSolutions-.*'))
      .map(synthesisMessageToString);
    expect(errors).toHaveLength(0);
  });

  test(`cdk-nag AwsSolutions Pack warnings`, () => {
    const warnings = Annotations.fromStack(stack)
      .findWarning('*', Match.stringLikeRegexp('AwsSolutions-.*'))
      .map(synthesisMessageToString);
    expect(warnings).toHaveLength(0);
  });

  test('uses Node.js 24 for pipeline test and synth CodeBuild projects', () => {
    const codeBuildProjects = template.findResources('AWS::CodeBuild::Project') as Record<
      string,
      { Properties?: { Source?: { BuildSpec?: string } } }
    >;
    const buildSpecsWithRuntime = Object.values(codeBuildProjects)
      .map((project) => project.Properties?.Source?.BuildSpec)
      .filter((buildSpec): buildSpec is string => buildSpec !== undefined)
      .map((buildSpec) => JSON.parse(buildSpec) as ParsedBuildSpec)
      .filter(hasNodeRuntime);

    expect(buildSpecsWithRuntime).toHaveLength(3);
    for (const buildSpec of buildSpecsWithRuntime) {
      expect(buildSpec.phases.install['runtime-versions'].nodejs).toBe('24.x');
    }
  });
});
