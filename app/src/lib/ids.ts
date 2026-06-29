export function slugifyMapId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

export function buildHistoryId(changedAt: string, version: number): string {
  return `h-${changedAt.replaceAll(':', '-').replaceAll('.', '-')}-v${version}`;
}
