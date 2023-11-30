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
      attributionDestination: new Set(['https://d.test']),
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
      attributionDestination: new Set(['https://d1.test', 'https://d2.test']),
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
      attributionDestination: new Set(['https://d.test']),
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
]

testCases.forEach((tc) =>
  jsontest.run(tc, () =>
    validateEventLevelReport(tc.json, tc.parseFullFlex ?? false)
  )
)
