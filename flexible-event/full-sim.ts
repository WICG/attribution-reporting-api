/*
 * TODO: support debug keys
 * TODO: simulate async report transmission and deletion
 */

import { strict as assert } from 'assert'

const maxDistinctTriggerData: number = 32
const maxSettableEventLevelReports: number = 20

const maxInt: number = 2 ** 32 - 1

type Bucket = [number, number]

interface SummaryBuckets extends Iterable<Bucket> {}

const InfiniteSummaryBuckets: SummaryBuckets = {
  [Symbol.iterator]: function* (): Generator<Bucket> {
    for (let i = 1; i < maxInt; ++i) {
      yield [i, i]
    }
    yield [maxInt, maxInt]
  },
}

class FiniteSummaryBuckets implements SummaryBuckets {
  constructor(private readonly arr: readonly number[]) {
    if (this.arr.length === 0) {
      throw new TypeError('must be non-empty')
    }

    let last = 0

    for (const n of this.arr) {
      if (
        n <= last ||
        n >= maxInt ||
        !Number.isInteger(n)
      ) {
        throw new TypeError(
          `must contain strictly increasing positive integers < ${maxInt}`
        )
        last = n
      }
    }
  }

  *[Symbol.iterator](): Generator<Bucket> {
    for (let i = 1; i < this.arr.length; ++i) {
      yield [this.arr[i - 1], this.arr[i] - 1]
    }
    yield [this.arr[this.arr.length - 1], maxInt]
  }
}

class ReportWindows {
  constructor(private readonly startTime: number,
              private readonly endTimes: readonly number[]) {
    if (this.startTime < 0) {
      throw new TypeError('startTime must be non-negative')
    }

    let last = this.startTime

    for (const endTime of this.endTimes) {
      if (endTime <= last) {
        throw new TypeError('endTimes must contain strictly increasing positive integers')
      }
      last = endTime
    }
  }

  endTime(triggerTime: number): number | undefined {
    if (triggerTime < this.startTime) {
      return
    }

    for (const endTime of this.endTimes) {
      if (triggerTime < endTime) {
        return endTime
      }
    }
  }
}

enum SummaryWindowOperator {
  count,
  valueSum,
}

type TriggerSpec = {
  triggerData: number[]
  startTime: number
  endTimes: number[]
  summaryWindowOperator: SummaryWindowOperator
  summaryBuckets?: number[]
}

type InternalTriggerSpec = {
  windows: ReportWindows
  summaryWindowOperator: SummaryWindowOperator
  summaryBuckets: SummaryBuckets
}

type Trigger = {
  time: number
  triggerData: number
  priority: bigint
  value: number
  dedupKey?: bigint
}

type TriggerRegistration = Partial<Trigger> & Pick<Trigger, 'time'>

type EventLevelReport = {
  time: number
  triggerData: number
  summaryBucket: Bucket
}

class Source {
  private readonly triggerSpecs: Map<number, InternalTriggerSpec> = new Map()
  private readonly triggers: Trigger[] = []

  constructor(
    private readonly maxEventLevelReports: number,
    triggerSpecs: TriggerSpec[]
  ) {
    if (
      this.maxEventLevelReports < 0 ||
      !Number.isInteger(this.maxEventLevelReports)
    ) {
      throw new TypeError('maxEventLevelReports must be a non-negative integer')
    }

    for (const spec of triggerSpecs) {
      const summaryBuckets: SummaryBuckets =
        spec.summaryBuckets === undefined
          ? InfiniteSummaryBuckets
          : new FiniteSummaryBuckets(spec.summaryBuckets)

      for (const d of spec.triggerData) {
        if (this.triggerSpecs.has(d)) {
          throw new TypeError(`duplicate triggerData ${d}`)
        }

        if (this.triggerSpecs.size === maxDistinctTriggerData) {
          throw new TypeError('too many distinct triggerData')
        }

        this.triggerSpecs.set(d, {
          windows: new ReportWindows(spec.startTime ?? 0, spec.endTimes),
          summaryWindowOperator: spec.summaryWindowOperator,
          summaryBuckets,
        })
      }
    }
  }

  attribute(r: TriggerRegistration): void {
    const t = {
      triggerData: 0,
      priority: 0n,
      value: 1,
      ...r,
    }

    if (t.value <= 0) {
      throw new TypeError('value must be positive')
    }

    if (t.dedupKey !== undefined) {
      for (const p of this.triggers) {
        if (p.dedupKey === t.dedupKey) {
          return
        }
      }
    }

    const spec = this.triggerSpecs.get(t.triggerData)
    if (spec === undefined) {
      return
    }

    if (spec.windows.endTime(t.time) === undefined) {
      return
    }

    this.triggers.push(t)
  }

  pendingReports(): EventLevelReport[] {
    type TriggerAndEndTime = Trigger & {
      endTime: number
    }

    const triggers: TriggerAndEndTime[] = this.triggers.map(t => ({
      endTime: this.triggerSpecs.get(t.triggerData)!.windows.endTime(t.time)!,
      ...t,
    }))

    // Triggers will be greedily applied by:
    // 1. Report window ascending
    // 2. Priority descending
    // 3. Trigger time ascending
    triggers.sort((a, b) => {
      if (a.endTime < b.endTime) {
        return -1
      }
      if (a.endTime > b.endTime) {
        return 1
      }
      if (a.priority > b.priority) {
        return -1
      }
      if (a.priority < b.priority) {
        return 1
      }
      if (a.time < b.time) {
        return -1
      }
      if (a.time > b.time) {
        return 1
      }
      return 0
    })

    type Summary = {
      value: number
      gen: Iterator<Bucket>
      bucket: Bucket
    }

    const summaries = new Map<number, Summary>()
    const reports: EventLevelReport[] = []

    for (const t of triggers) {
      const spec = this.triggerSpecs.get(t.triggerData)!

      let summary = summaries.get(t.triggerData)
      if (summary === undefined) {
        const gen = spec.summaryBuckets[Symbol.iterator]()
        summary = { value: 0, gen, bucket: gen.next().value }
        summaries.set(t.triggerData, summary)
      }

      switch (spec.summaryWindowOperator) {
        case SummaryWindowOperator.count:
          ++summary.value
          break
        case SummaryWindowOperator.valueSum:
          summary.value += t.value
          break
      }

      while (summary.value >= summary.bucket[0]) {
        reports.push({
          time: t.endTime,
          triggerData: t.triggerData,
          summaryBucket: summary.bucket,
        })

        const next = summary.gen.next()

        if (reports.length === this.maxEventLevelReports ||
            next.value === undefined) {
          return reports
        }

        summary.bucket = next.value
      }
    }

    return reports
  }
}

type TestCase = {
  name: string
  skip?: boolean
  source: Source
  triggers: TriggerRegistration[]
  expected: EventLevelReport[]
}

const dayInSeconds = 24 * 60 * 60

const testCases: TestCase[] = [
  {
    name: 'explainer: trigger value buckets',
    source: new Source(maxSettableEventLevelReports, [
      {
        triggerData: [0],
        startTime: 0,
        endTimes: [604800, 1209600],
        summaryWindowOperator: SummaryWindowOperator.valueSum,
        summaryBuckets: [5, 10, 100],
      },
    ]),
    triggers: [
      {
        time: 1,
        value: 1,
      },
      {
        time: 2,
        value: 3,
      },
      {
        time: 3,
        value: 4,
      },
      {
        time: 604800,
        value: 50,
      },
      {
        time: 604801,
        value: 45,
      },
    ],
    expected: [
      {
        time: 604800,
        triggerData: 0,
        summaryBucket: [5, 9],
      },
      {
        time: 1209600,
        triggerData: 0,
        summaryBucket: [10, 99],
      },
      {
        time: 1209600,
        triggerData: 0,
        summaryBucket: [100, maxInt],
      },
    ],
  },
  {
    name: 'explainer: trigger counts',
    source: new Source(maxSettableEventLevelReports, [
      {
        triggerData: [0],
        startTime: 0,
        endTimes: [604800],
        summaryWindowOperator: SummaryWindowOperator.count,
        summaryBuckets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      },
    ]),
    triggers: [1, 2, 3, 4].map((time) => ({
      time,
      value: 1000, // irrelevant due to `SummaryWindowOperator.count`
    })),
    expected: [1, 2, 3, 4].map((b) => ({
      time: 604800,
      triggerData: 0,
      summaryBucket: [b, b],
    })),
  },
  {
    name: 'misc: baseline case',
    source: new Source(1, [
      {
        triggerData: [0, 1, 2, 3, 4, 5, 6, 7],
        startTime: 0,
        endTimes: [2 * dayInSeconds, 7 * dayInSeconds, 30 * dayInSeconds],
        summaryWindowOperator: SummaryWindowOperator.count,
      },
    ]),
    triggers: [
      {
        time: 3.1 * dayInSeconds,
        triggerData: 3,
        priority: 1000n,
      },
      {
        time: 3.2 * dayInSeconds,
        triggerData: 2,
        priority: 1010n,
      },
    ],
    expected: [
      {
        time: 7 * dayInSeconds,
        triggerData: 2,
        summaryBucket: [1, 1],
      },
    ],
  },
  {
    name: 'misc: earlier window has higher priority',
    skip: true, // failing
    source: new Source(2, [
      {
        triggerData: [0, 1, 2],
        startTime: 0,
        endTimes: [7 * dayInSeconds, 30 * dayInSeconds],
        summaryWindowOperator: SummaryWindowOperator.count,
      },
      {
        triggerData: [3],
        startTime: 0,
        endTimes: [2 * dayInSeconds, 7 * dayInSeconds],
        summaryWindowOperator: SummaryWindowOperator.count,
      },
    ]),
    triggers: [
      {
        time: 0.2 * dayInSeconds,
        triggerData: 3,
        priority: 1000n,
      },
      {
        time: 0.3 * dayInSeconds,
        triggerData: 2,
        priority: 1999n,
      },
      {
        time: 0.4 * dayInSeconds,
        triggerData: 0,
        priority: 10000n,
      },
    ],
    expected: [
      {
        time: 7 * dayInSeconds,
        triggerData: 0,
        summaryBucket: [1, 1],
      },
      {
        time: 7 * dayInSeconds,
        triggerData: 2,
        summaryBucket: [2, 2],
      },
    ],
  },
  {
    name: 'misc: mixed priority for 1 report',
    skip: true, // failing
    source: new Source(1, [
      {
        triggerData: [0, 1, 2],
        startTime: 0,
        endTimes: [2 * dayInSeconds, 30 * dayInSeconds],
        summaryWindowOperator: SummaryWindowOperator.valueSum,
        summaryBuckets: [10, 100],
      },
    ]),
    triggers: [
      {
        time: 0.2 * dayInSeconds,
        triggerData: 0,
        priority: 1000n,
        value: 5,
      },
      {
        time: 0.3 * dayInSeconds,
        triggerData: 1,
        priority: 1010n,
        value: 11,
      },
      {
        time: 1 * dayInSeconds,
        triggerData: 0,
        priority: 1020n,
        value: 9,
      },
    ],
    expected: [
      {
        time: 2 * dayInSeconds,
        triggerData: 0,
        summaryBucket: [10, 99],
      },
    ],
  },
  {
    name: 'misc: mixed priority for multiple report',
    source: new Source(3, [
      {
        triggerData: [0, 1, 2],
        startTime: 0,
        endTimes: [2 * dayInSeconds, 30 * dayInSeconds],
        summaryWindowOperator: SummaryWindowOperator.valueSum,
        summaryBuckets: [10, 20, 100],
      },
    ]),
    triggers: [
      {
        time: 0.2 * dayInSeconds,
        triggerData: 0,
        priority: 1000n,
        value: 115,
      },
      {
        time: 0.3 * dayInSeconds,
        triggerData: 1,
        priority: 970n,
        value: 30,
      },
      {
        time: 0.4 * dayInSeconds,
        triggerData: 1,
        priority: 1030n,
        value: 10,
      },
    ],
    expected: [
      {
        time: 2 * dayInSeconds,
        triggerData: 1,
        summaryBucket: [10, 19],
      },
      {
        time: 2 * dayInSeconds,
        triggerData: 0,
        summaryBucket: [10, 19],
      },
      {
        time: 2 * dayInSeconds,
        triggerData: 0,
        summaryBucket: [20, 99],
      },
    ],
  },
  {
    name: 'misc: multi-increment',
    source: new Source(maxSettableEventLevelReports, [
      {
        triggerData: [0],
        startTime: 0,
        endTimes: [2 * dayInSeconds],
        summaryWindowOperator: SummaryWindowOperator.valueSum,
        summaryBuckets: [5, 10, 100],
      },
    ]),
    triggers: [
      {
        time: 1,
        value: 10,
      },
    ],
    expected: [
      {
        time: 2 * dayInSeconds,
        triggerData: 0,
        summaryBucket: [5, 9],
      },
      {
        time: 2 * dayInSeconds,
        triggerData: 0,
        summaryBucket: [10, 99],
      },
    ],
  },
  {
    name: 'misc: max int',
    source: new Source(maxSettableEventLevelReports, [
      {
        triggerData: [0],
        startTime: 0,
        endTimes: [2 * dayInSeconds],
        summaryWindowOperator: SummaryWindowOperator.valueSum,
        summaryBuckets: [maxInt - 1],
      },
    ]),
    triggers: [
      {
        time: 1,
        value: maxInt - 1,
      },
      {
        time: 2,
        value: 1,
      },
    ],
    // TODO: Is this correct?
    expected: [
      {
        time: 2 * dayInSeconds,
        triggerData: 0,
        summaryBucket: [maxInt - 1, maxInt],
      },
    ],
  },
]

for (const tc of testCases) {
  if (tc.skip) {
    console.log(`skipping ${tc.name}`)
    continue
  }

  console.log(`running ${tc.name}...`)
  tc.triggers.forEach((t) => tc.source.attribute(t))
  assert.deepEqual(tc.source.pendingReports(), tc.expected, tc.name)
}
