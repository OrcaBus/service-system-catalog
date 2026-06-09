import { ValidationError } from './errors';

export function formatEtag(version: number): string {
  return `"${version}"`;
}

export function parseIfMatchHeader(value: string | undefined): number {
  if (!value) {
    throw new ValidationError('If-Match header is required.', [
      { path: 'If-Match', message: 'Required' },
    ]);
  }

  const match = /^"(?<version>\d+)"$/.exec(value);
  if (!match?.groups?.version) {
    throw new ValidationError('If-Match header must be a quoted integer.', [
      { path: 'If-Match', message: 'Expected format like "5"' },
    ]);
  }

  return Number.parseInt(match.groups.version, 10);
}
