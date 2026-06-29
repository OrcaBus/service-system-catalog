import { App, Validations } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';
import { StatefulStack } from '../infrastructure/toolchain/stateful-stack';

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

  Validations.of(stack).addPlugins(new AwsSolutionsChecks(stack));

  Validations.of(stack).acknowledge(
    { id: 'AwsSolutions-IAM4', reason: 'Allow CDK Pipeline' },
    { id: 'AwsSolutions-IAM5', reason: 'Allow CDK Pipeline' },
    { id: 'AwsSolutions-S1', reason: 'Allow CDK Pipeline' },
    { id: 'AwsSolutions-KMS5', reason: 'Allow CDK Pipeline' },
    { id: 'AwsSolutions-CB3', reason: 'Allow CDK Pipeline' }
  );
  const template = Template.fromStack(stack);

  test('cdk-nag AwsSolutions Pack checks pass synthesis', () => {
    expect(() => app.synth()).not.toThrow();
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
