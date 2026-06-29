import { SynthesisMessage } from '@aws-cdk/cloud-assembly-api';

export function synthesisMessageToString(sm: SynthesisMessage): string {
  return `${sm.entry.data} [${sm.id}]`;
}
