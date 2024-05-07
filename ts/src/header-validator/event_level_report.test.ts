import { SourceType } from '../source-type'
import { Maybe } from './maybe'
import { EventLevelReport, validateEventLevelReport } from './validate-json'
import * as jsontest from './validate-json.test'

const testCases: jsontest.TestCase<EventLevelReport>[] = [
  {
    name: 'valid-minimal',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_event_id": "1",
      "source_type": "navigation",
      "trigger_data": "2"
    }`,
    expected: Maybe.some({
      attributionDestination: 'https://d.test',
      randomizedTriggerRate: 0.4,
      reportId: 'ac908546-2609-49d9-95b0-b796f9774da6',
      scheduledReportTime: 789n,
      sourceDebugKey: null,
      sourceType: SourceType.navigation,
      sourceEventId: 1n,
      triggerData: 2n,
      triggerDebugKey: null,
      triggerSummaryBucket: null,
    }),
  },
  {
    name: 'valid-multi-dest-event-source-debug-keys',
    json: `{
      "attribution_destination": [
        "https://d1.test",
        "https://d2.test"
      ],
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_debug_key": "3",
      "source_event_id": "1",
      "source_type": "event",
      "trigger_data": "2",
      "trigger_debug_key": "5",
      "x": null
    }`,
    expected: Maybe.some({
      attributionDestination: ['https://d1.test', 'https://d2.test'],
      randomizedTriggerRate: 0.4,
      reportId: 'ac908546-2609-49d9-95b0-b796f9774da6',
      scheduledReportTime: 789n,
      sourceDebugKey: 3n,
      sourceType: SourceType.event,
      sourceEventId: 1n,
      triggerData: 2n,
      triggerDebugKey: 5n,
      triggerSummaryBucket: null,
    }),
    expectedWarnings: [
      {
        msg: 'unknown field',
        path: ['x'],
      },
    ],
  },
  {
    name: 'full-flex-minimal',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_event_id": "1",
      "source_type": "navigation",
      "trigger_data": "2",
      "trigger_summary_bucket": [5, 5]
    }`,
    parseFullFlex: true,
    expected: Maybe.some({
      attributionDestination: 'https://d.test',
      randomizedTriggerRate: 0.4,
      reportId: 'ac908546-2609-49d9-95b0-b796f9774da6',
      scheduledReportTime: 789n,
      sourceDebugKey: null,
      sourceType: SourceType.navigation,
      sourceEventId: 1n,
      triggerData: 2n,
      triggerDebugKey: null,
      triggerSummaryBucket: [5, 5],
    }),
  },

  {
    name: 'missing-fields',
    json: `{}`,
    parseFullFlex: true,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'required',
        path: ['attribution_destination'],
      },
      {
        msg: 'required',
        path: ['randomized_trigger_rate'],
      },
      {
        msg: 'required',
        path: ['report_id'],
      },
      {
        msg: 'required',
        path: ['scheduled_report_time'],
      },
      {
        msg: 'required',
        path: ['source_event_id'],
      },
      {
        msg: 'required',
        path: ['source_type'],
      },
      {
        msg: 'required',
        path: ['trigger_data'],
      },
      {
        msg: 'required',
        path: ['trigger_summary_bucket'],
      },
    ],
  },

  {
    name: 'full-flex-trigger-summary-bucket-type',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_event_id": "1",
      "source_type": "navigation",
      "trigger_data": "2",
      "trigger_summary_bucket": null
    }`,
    parseFullFlex: true,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'must be a list',
        path: ['trigger_summary_bucket'],
      },
    ],
  },
  {
    name: 'full-flex-trigger-summary-bucket-item-type',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_event_id": "1",
      "source_type": "navigation",
      "trigger_data": "2",
      "trigger_summary_bucket": ["1", 2]
    }`,
    parseFullFlex: true,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'must be a number',
        path: ['trigger_summary_bucket', 0],
      },
    ],
  },
  {
    name: 'full-flex-trigger-summary-bucket-empty',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_event_id": "1",
      "source_type": "navigation",
      "trigger_data": "2",
      "trigger_summary_bucket": []
    }`,
    parseFullFlex: true,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'length must be in the range [2, 2]',
        path: ['trigger_summary_bucket'],
      },
    ],
  },
  {
    name: 'full-flex-trigger-summary-bucket-start-lt-1',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_event_id": "1",
      "source_type": "navigation",
      "trigger_data": "2",
      "trigger_summary_bucket": [0, 4]
    }`,
    parseFullFlex: true,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'must be >= minimum bucket start (1) and <= uint32 max (4294967295)',
        path: ['trigger_summary_bucket', 0],
      },
    ],
  },
  {
    name: 'full-flex-trigger-summary-bucket-end-lt-start',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_event_id": "1",
      "source_type": "navigation",
      "trigger_data": "2",
      "trigger_summary_bucket": [5, 4]
    }`,
    parseFullFlex: true,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'must be >= bucket start (5) and <= uint32 max (4294967295)',
        path: ['trigger_summary_bucket', 1],
      },
    ],
  },

  {
    name: 'invalid-report-id',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": 0.4,
      "report_id": "123",
      "scheduled_report_time": "789",
      "source_event_id": "1",
      "source_type": "navigation",
      "trigger_data": "2"
    }`,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'must be a valid UUID',
        path: ['report_id'],
      },
    ],
  },
  {
    name: 'invalid-report-id-version',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": 0.4,
      "report_id": "00000000-0000-0000-0000-000000000000",
      "scheduled_report_time": "789",
      "source_event_id": "1",
      "source_type": "navigation",
      "trigger_data": "2"
    }`,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'must be a version 4 (random) UUID',
        path: ['report_id'],
      },
    ],
  },

  {
    name: 'invalid-destination-components',
    json: `{
      "attribution_destination": "https://d.test/x",
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_event_id": "1",
      "source_type": "navigation",
      "trigger_data": "2"
    }`,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'must not contain URL components other than site (https://d.test)',
        path: ['attribution_destination'],
      },
    ],
  },
  {
    name: 'invalid-destination-type',
    json: `{
      "attribution_destination": null,
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_event_id": "1",
      "source_type": "navigation",
      "trigger_data": "2"
    }`,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'must be a string or a list',
        path: ['attribution_destination'],
      },
    ],
  },
  {
    name: 'invalid-destination-size',
    json: `{
      "attribution_destination": ["https://d.test"],
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_event_id": "1",
      "source_type": "navigation",
      "trigger_data": "2"
    }`,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'length must be in the range [2, 3]',
        path: ['attribution_destination'],
      },
    ],
  },
  {
    name: 'unsorted-destination',
    json: `{
      "attribution_destination": ["https://d.test", "https://c.test"],
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_event_id": "1",
      "source_type": "navigation",
      "trigger_data": "2"
    }`,
    expected: Maybe.some({
      attributionDestination: ['https://d.test', 'https://c.test'],
      randomizedTriggerRate: 0.4,
      reportId: 'ac908546-2609-49d9-95b0-b796f9774da6',
      scheduledReportTime: 789n,
      sourceDebugKey: null,
      sourceType: SourceType.navigation,
      sourceEventId: 1n,
      triggerData: 2n,
      triggerDebugKey: null,
      triggerSummaryBucket: null,
    }),
    expectedWarnings: [
      {
        msg: 'although order is semantically irrelevant, list is expected to be sorted',
        path: ['attribution_destination'],
      },
    ],
  },

  {
    name: 'invalid-scheduled-report-time-type',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": 789,
      "source_event_id": "1",
      "source_type": "navigation",
      "trigger_data": "2"
    }`,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'must be a string',
        path: ['scheduled_report_time'],
      },
    ],
  },
  {
    name: 'invalid-scheduled-report-time-value',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "x",
      "source_event_id": "1",
      "source_type": "navigation",
      "trigger_data": "2"
    }`,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'must be an int64 (must match /^-?[0-9]+$/)',
        path: ['scheduled_report_time'],
      },
    ],
  },

  {
    name: 'invalid-source-event-id-type',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_event_id": 1,
      "source_type": "navigation",
      "trigger_data": "2"
    }`,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'must be a string',
        path: ['source_event_id'],
      },
    ],
  },
  {
    name: 'invalid-source-event-id-value',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_event_id": "x",
      "source_type": "navigation",
      "trigger_data": "2"
    }`,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'must be a uint64 (must match /^[0-9]+$/)',
        path: ['source_event_id'],
      },
    ],
  },

  {
    name: 'invalid-trigger-data-type',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_event_id": "1",
      "source_type": "navigation",
      "trigger_data": 2
    }`,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'must be a string',
        path: ['trigger_data'],
      },
    ],
  },
  {
    name: 'invalid-trigger-data-value',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_event_id": "1",
      "source_type": "navigation",
      "trigger_data": "x"
    }`,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'must be a uint64 (must match /^[0-9]+$/)',
        path: ['trigger_data'],
      },
    ],
  },

  {
    name: 'invalid-randomized-trigger-rate-type',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": "0.4",
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_event_id": "1",
      "source_type": "navigation",
      "trigger_data": "2"
    }`,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'must be a number',
        path: ['randomized_trigger_rate'],
      },
    ],
  },
  {
    name: 'invalid-randomized-trigger-rate-value',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": -1,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_event_id": "1",
      "source_type": "navigation",
      "trigger_data": "2"
    }`,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'must be in the range [0, 1]',
        path: ['randomized_trigger_rate'],
      },
    ],
  },

  {
    name: 'invalid-source-type-type',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_event_id": "1",
      "source_type": null,
      "trigger_data": "2"
    }`,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'must be a string',
        path: ['source_type'],
      },
    ],
  },
  {
    name: 'invalid-source-type-value',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_event_id": "1",
      "source_type": "x",
      "trigger_data": "2"
    }`,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'must be one of the following (case-sensitive): event, navigation',
        path: ['source_type'],
      },
    ],
  },

  {
    name: 'invalid-source-debug-key-type',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_debug_key": 3,
      "source_event_id": "1",
      "source_type": "event",
      "trigger_data": "2"
    }`,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'must be a string',
        path: ['source_debug_key'],
      },
    ],
  },
  {
    name: 'invalid-source-debug-key-value',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_debug_key": "x",
      "source_event_id": "1",
      "source_type": "event",
      "trigger_data": "2"
    }`,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'must be a uint64 (must match /^[0-9]+$/)',
        path: ['source_debug_key'],
      },
    ],
  },

  {
    name: 'invalid-trigger-debug-key-type',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_event_id": "1",
      "source_type": "event",
      "trigger_data": "2",
      "trigger_debug_key": 3
    }`,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'must be a string',
        path: ['trigger_debug_key'],
      },
    ],
  },
  {
    name: 'invalid-trigger-debug-key-value',
    json: `{
      "attribution_destination": "https://d.test",
      "randomized_trigger_rate": 0.4,
      "report_id": "ac908546-2609-49d9-95b0-b796f9774da6",
      "scheduled_report_time": "789",
      "source_event_id": "1",
      "source_type": "event",
      "trigger_data": "2",
      "trigger_debug_key": "x"
    }`,
    expected: Maybe.None,
    expectedErrors: [
      {
        msg: 'must be a uint64 (must match /^[0-9]+$/)',
        path: ['trigger_debug_key'],
      },
    ],
  },
]

testCases.forEach((tc) =>
  jsontest.run(tc, () =>
    validateEventLevelReport(tc.json, tc.parseFullFlex ?? false)
  )
)
