export type CommonDebug = {
  debugKey: bigint | null
  debugReporting: boolean
}

export type Priority = {
  priority: bigint
}

export type KeyPiece = {
  keyPiece: bigint
}

export type AggregatableDebugReportingData = KeyPiece & {
  types: Set<string>
  value: number
}

export type AggregationCoordinatorOrigin = {
  aggregationCoordinatorOrigin: string
}

export type AggregatableDebugReportingConfig = KeyPiece &
  AggregationCoordinatorOrigin & {
    debugData: AggregatableDebugReportingData[]
  }
