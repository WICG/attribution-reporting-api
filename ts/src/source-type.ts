export enum SourceType {
  event = 'event',
  navigation = 'navigation',
}

export function parseSourceType(str: string): SourceType {
  if (!(str in SourceType)) {
    throw new Error('unknown source type')
  }
  return str as SourceType
}
