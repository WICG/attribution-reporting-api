import { SourceType } from '../source-type'
import * as vsv from '../vendor-specific-values'
import { Maybe } from './maybe'
import {
  Source,
  SummaryWindowOperator,
  TriggerDataMatching,
  validateSource,
} from './validate-json'
import * as jsontest from './validate-json.test'

type TestCase = jsontest.TestCase<Source> & {
  sourceType?: SourceType
}

const testCases: TestCase[] = [
  // no errors or warnings
  {
    name: 'required-fields-only',
    json: `{"destination": "https://a.test"}`,
  },
  {
    name: 'multi-destination',
    json: `{"destination": ["https://a.test", "https://b.test"]}`,
  },
  {
    name: 'all-fields',
    json: `{
      "aggregatable_report_window": "3601",
      "aggregation_keys": {"a": "0xf"},
      "debug_key": "1",
      "debug_reporting": true,
      "destination": "https://a.test",
      "event_report_window": "3601",
      "expiry": "86400",
      "filter_data": {"b": ["c"]},
      "priority": "2",
      "source_event_id": "3",
      "max_event_level_reports": 2
    }`,
    sourceType: SourceType.navigation,
    expected: Maybe.some({
      aggregatableReportWindow: 3601,
      aggregationKeys: new Map([['a', 15n]]),
      debugKey: 1n,
      debugReporting: true,
      destination: new Set(['https://a.test']),
      eventReportWindows: {
        startTime: 0,
        endTimes: [3601],
      },
      expiry: 86400,
      filterData: new Map([['b', new Set(['c'])]]),
      priority: 2n,
      sourceEventId: 3n,
      maxEventLevelReports: 2,
      triggerSpecs: [
        {
          eventReportWindows: {
            startTime: 0,
            endTimes: [3601],
          },
          summaryBuckets: [1, 2],
          summaryWindowOperator: SummaryWindowOperator.count,
          triggerData: new Set([0, 1, 2, 3, 4, 5, 6, 7]),
        },
      ],
      triggerDataMatching: TriggerDataMatching.modulus,
    }),
  },

  // warnings
  {
    name: 'unknown-field',
    json: `{
      "destination": "https://a.test",
      "trigger_specs": []
    }`,
    expectedWarnings: [
      {
        path: ['trigger_specs'],
        msg: 'unknown field',
      },
    ],
  },
  {
    name: 'destination-url-components',
    json: `{"destination": ["https://a.test/b?c=d#e", "https://x.y.test", "https://sub.a.test/z"]}`,
    expectedWarnings: [
      {
        path: ['destination', 0],
        msg: 'URL components other than site (https://a.test) will be ignored',
      },
      {
        path: ['destination', 1],
        msg: 'URL components other than site (https://y.test) will be ignored',
      },
      {
        path: ['destination', 2],
        msg: 'URL components other than site (https://a.test) will be ignored',
      },
      {
        path: ['destination', 2],
        msg: 'duplicate value https://a.test',
      },
    ],
  },

  // errors
  {
    name: 'invalid-json',
    json: ``,
    expectedErrors: [{ msg: 'SyntaxError: Unexpected end of JSON input' }],
    expected: Maybe.None,
  },
  {
    name: 'wrong-root-type',
    json: `1`,
    expectedErrors: [
      {
        path: [],
        msg: 'must be an object',
      },
    ],
    expected: Maybe.None,
  },
  {
    name: 'wrong-root-type-null',
    json: `null`,
    expectedErrors: [
      {
        path: [],
        msg: 'must be an object',
      },
    ],
  },

  {
    name: 'destination-missing',
    json: `{}`,
    expectedErrors: [
      {
        path: ['destination'],
        msg: 'required',
      },
    ],
  },
  {
    name: 'destination-wrong-type',
    json: `{"destination": 1}`,
    expectedErrors: [
      {
        path: ['destination'],
        msg: 'must be a string or a list',
      },
    ],
  },
  {
    name: 'destination-not-url',
    json: `{"destination": "a.test"}`,
    expectedErrors: [
      {
        path: ['destination'],
        msg: 'invalid URL',
      },
    ],
  },
  {
    name: 'destination-untrustworthy',
    json: `{"destination": "http://a.test"}`,
    expectedErrors: [
      {
        path: ['destination'],
        msg: 'URL must use HTTP/HTTPS and be potentially trustworthy',
      },
    ],
  },

  {
    name: 'filter-data-wrong-type',
    json: `{
      "destination": "https://a.test",
      "filter_data": 1
    }`,
    expectedErrors: [
      {
        path: ['filter_data'],
        msg: 'must be an object',
      },
    ],
  },
  {
    name: 'filter-data-wrong-type-null',
    json: `{
      "destination": "https://a.test",
      "filter_data": null
    }`,
    expectedErrors: [
      {
        path: ['filter_data'],
        msg: 'must be an object',
      },
    ],
  },
  {
    name: 'filter-data-values-wrong-type',
    json: `{
      "destination": "https://a.test",
      "filter_data": {"a": "b"}
    }`,
    expectedErrors: [
      {
        path: ['filter_data', 'a'],
        msg: 'must be a list',
      },
    ],
  },
  {
    name: 'filter-data-value-wrong-type',
    json: `{
      "destination": "https://a.test",
      "filter_data": {"a": [1]}
    }`,
    expectedErrors: [
      {
        path: ['filter_data', 'a', 0],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'filter-data-source-type-key',
    json: `{
      "destination": "https://a.test",
      "filter_data": {"source_type": []}
    }`,
    expectedErrors: [
      {
        path: ['filter_data', 'source_type'],
        msg: 'is prohibited because it is implicitly set',
      },
    ],
  },
  {
    name: 'filter-data-lookback-window-key',
    json: `{
      "destination": "https://a.test",
      "filter_data": {"_lookback_window": []}
    }`,
    expectedErrors: [
      {
        path: ['filter_data', '_lookback_window'],
        msg: 'is prohibited because it is implicitly set',
      },
    ],
  },
  {
    name: 'filter-data-reserved-key',
    json: `{
      "destination": "https://a.test",
      "filter_data": {"_some_key": []}
    }`,
    expectedErrors: [
      {
        path: ['filter_data', '_some_key'],
        msg: 'is prohibited as keys starting with "_" are reserved',
      },
    ],
  },
  {
    name: 'filter-data-duplicate-value',
    json: `{
      "destination": "https://a.test",
      "filter_data": {
        "a": ["x", "y", "x"],
        "b": ["y"]
      }
    }`,
    expectedWarnings: [
      {
        path: ['filter_data', 'a', 2],
        msg: 'duplicate value x',
      },
    ],
  },
  {
    name: 'filter-data-key-too-long',
    json: `{
      "destination": "https://a.test",
      "filter_data": {"aaaaaaaaaaaaaaaaaaaaaaaaaa": ["x"]}
    }`,
    expectedErrors: [
      {
        path: ['filter_data', 'aaaaaaaaaaaaaaaaaaaaaaaaaa'],
        msg: 'key exceeds max length per filter string (26 > 25)',
      },
    ],
  },
  {
    name: 'filter-data-value-too-long',
    json: `{
      "destination": "https://a.test",
      "filter_data": {"a": ["xxxxxxxxxxxxxxxxxxxxxxxxxx"]}
    }`,
    expectedErrors: [
      {
        path: ['filter_data', 'a', 0],
        msg: 'exceeds max length per filter string (26 > 25)',
      },
    ],
  },
  // TODO: add tests for exceeding size limits

  {
    name: 'aggregation-keys-wrong-type',
    json: `{
      "destination": "https://a.test",
      "aggregation_keys": 1
    }`,
    expectedErrors: [
      {
        path: ['aggregation_keys'],
        msg: 'must be an object',
      },
    ],
  },
  {
    name: 'aggregation-keys-value-wrong-type',
    json: `{
      "destination": "https://a.test",
      "aggregation_keys": {"a": 1}
    }`,
    expectedErrors: [
      {
        path: ['aggregation_keys', 'a'],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'aggregation-keys-value-wrong-format',
    json: `{
      "destination": "https://a.test",
      "aggregation_keys": {"a": "3"}
    }`,
    expectedErrors: [
      {
        path: ['aggregation_keys', 'a'],
        msg: 'must be a hex128 (must match /^0[xX][0-9A-Fa-f]{1,32}$/)',
      },
    ],
  },
  {
    name: 'aggregation-keys-too-many',
    json: `{
      "destination": "https://a.test",
      "aggregation_keys": {
        "1": "0x1",
        "2": "0x1",
        "3": "0x1",
        "4": "0x1",
        "5": "0x1",
        "6": "0x1",
        "7": "0x1",
        "8": "0x1",
        "9": "0x1",
        "10": "0x1",
        "11": "0x1",
        "12": "0x1",
        "13": "0x1",
        "14": "0x1",
        "15": "0x1",
        "16": "0x1",
        "17": "0x1",
        "18": "0x1",
        "19": "0x1",
        "20": "0x1",
        "21": "0x1"
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregation_keys'],
        msg: 'exceeds the maximum number of keys (20)',
      },
    ],
  },
  {
    name: 'aggregation-keys-key-too-long',
    json: `{
      "destination": "https://a.test",
      "aggregation_keys": {
        "aaaaaaaaaaaaaaaaaaaaaaaaaa": "0x1"
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregation_keys', 'aaaaaaaaaaaaaaaaaaaaaaaaaa'],
        msg: 'key exceeds max length per aggregation key identifier (26 > 25)',
      },
    ],
  },
  {
    name: 'aggregation-keys-key-too-long-non-ascii',
    json: `{
      "destination": "https://a.test",
      "aggregation_keys": {
        "aaaaaaaaaaaaaaaaaaaaaaaaa\u03A9": "0x1"
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregation_keys', 'aaaaaaaaaaaaaaaaaaaaaaaaa\u03A9'],
        msg: 'key exceeds max length per aggregation key identifier (26 > 25)',
      },
    ],
  },
  // TODO: add tests for exceeding size limits

  {
    name: 'source-event-id-wrong-type',
    json: `{
      "destination": "https://a.test",
      "source_event_id": 1
    }`,
    expectedErrors: [
      {
        path: ['source_event_id'],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'source-event-id-wrong-format',
    json: `{
      "destination": "https://a.test",
      "source_event_id": "-1"
    }`,
    expectedErrors: [
      {
        path: ['source_event_id'],
        msg: 'must be a uint64 (must match /^[0-9]+$/)',
      },
    ],
  },

  {
    name: 'debug-key-wrong-type',
    json: `{
      "destination": "https://a.test",
      "debug_key": 1
    }`,
    expectedErrors: [
      {
        path: ['debug_key'],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'debug-key-wrong-format',
    json: `{
      "destination": "https://a.test",
      "debug_key": "-1"
    }`,
    expectedErrors: [
      {
        path: ['debug_key'],
        msg: 'must be a uint64 (must match /^[0-9]+$/)',
      },
    ],
  },

  {
    name: 'priority-wrong-type',
    json: `{
      "destination": "https://a.test",
      "priority": 1
    }`,
    expectedErrors: [
      {
        path: ['priority'],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'priority-wrong-format',
    json: `{
      "destination": "https://a.test",
      "priority": "x"
    }`,
    expectedErrors: [
      {
        path: ['priority'],
        msg: 'must be an int64 (must match /^-?[0-9]+$/)',
      },
    ],
  },

  {
    name: 'aggregatable-report-window-integer',
    json: `{
      "destination": "https://a.test",
      "aggregatable_report_window": 3601
    }`,
  },
  {
    name: 'aggregatable-report-window-clamp-min',
    json: `{
      "destination": "https://a.test",
      "aggregatable_report_window": 3599
    }`,
    expectedWarnings: [
      {
        path: ['aggregatable_report_window'],
        msg: 'will be clamped to min of 3600',
      },
    ],
  },
  {
    name: 'aggregatable-report-window-clamp-max',
    json: `{
      "destination": "https://a.test",
      "expiry": 259200,
      "aggregatable_report_window": 259201
    }`,
    expectedWarnings: [
      {
        path: ['aggregatable_report_window'],
        msg: 'will be clamped to max of 259200 (expiry)',
      },
    ],
  },
  {
    name: 'aggregatable-report-window-wrong-type',
    json: `{
      "destination": "https://a.test",
      "aggregatable_report_window": false
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_report_window'],
        msg: 'must be a number or a string',
      },
    ],
  },
  {
    name: 'aggregatable-report-window-wrong-format',
    json: `{
      "destination": "https://a.test",
      "aggregatable_report_window": "x"
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_report_window'],
        msg: 'must be a uint64 (must match /^[0-9]+$/)',
      },
    ],
  },
  {
    name: 'aggregatable-report-window-wrong-sign',
    json: `{
      "destination": "https://a.test",
      "aggregatable_report_window": "-1"
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_report_window'],
        msg: 'must be a uint64 (must match /^[0-9]+$/)',
      },
    ],
  },
  {
    name: 'aggregatable-report-window-integer-wrong-sign',
    json: `{
      "destination": "https://a.test",
      "aggregatable_report_window": -1
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_report_window'],
        msg: 'must be non-negative',
      },
    ],
  },
  {
    name: 'aggregatable-report-window-invalid-expiry',
    json: `{
      "destination": "https://a.test",
      "expiry": -1,
      "aggregatable_report_window": 3601
    }`,
    expectedErrors: [
      {
        path: ['expiry'],
        msg: 'must be non-negative',
      },
      {
        path: ['aggregatable_report_window'],
        msg: 'cannot be fully validated without a valid expiry',
      },
    ],
  },

  {
    name: 'event-report-window-integer',
    json: `{
      "destination": "https://a.test",
      "event_report_window": 3601
    }`,
  },
  {
    name: 'event-report-window-clamp-min',
    json: `{
      "destination": "https://a.test",
      "event_report_window": 3599
    }`,
    expectedWarnings: [
      {
        path: ['event_report_window'],
        msg: 'will be clamped to min of 3600',
      },
    ],
  },
  {
    name: 'event-report-window-clamp-max',
    json: `{
      "destination": "https://a.test",
      "expiry": 259200,
      "event_report_window": 259201
    }`,
    expectedWarnings: [
      {
        path: ['event_report_window'],
        msg: 'will be clamped to max of 259200 (expiry)',
      },
    ],
  },
  {
    name: 'event-report-window-wrong-type',
    json: `{
      "destination": "https://a.test",
      "event_report_window": false
    }`,
    expectedErrors: [
      {
        path: ['event_report_window'],
        msg: 'must be a number or a string',
      },
    ],
  },
  {
    name: 'event-report-window-wrong-format',
    json: `{
      "destination": "https://a.test",
      "event_report_window": "x"
    }`,
    expectedErrors: [
      {
        path: ['event_report_window'],
        msg: 'must be a uint64 (must match /^[0-9]+$/)',
      },
    ],
  },
  {
    name: 'event-report-window-wrong-sign',
    json: `{
      "destination": "https://a.test",
      "event_report_window": "-1"
    }`,
    expectedErrors: [
      {
        path: ['event_report_window'],
        msg: 'must be a uint64 (must match /^[0-9]+$/)',
      },
    ],
  },
  {
    name: 'event-report-window-integer-wrong-sign',
    json: `{
      "destination": "https://a.test",
      "event_report_window": -1
    }`,
    expectedErrors: [
      {
        path: ['event_report_window'],
        msg: 'must be non-negative',
      },
    ],
  },
  {
    name: 'expiry-integer',
    json: `{
      "destination": "https://a.test",
      "expiry": 86400
    }`,
  },
  {
    name: 'expiry-wrong-type',
    json: `{
      "destination": "https://a.test",
      "expiry": false
    }`,
    expectedErrors: [
      {
        path: ['expiry'],
        msg: 'must be a number or a string',
      },
    ],
  },
  {
    name: 'expiry-wrong-format',
    json: `{
      "destination": "https://a.test",
      "expiry": "x"
    }`,
    expectedErrors: [
      {
        path: ['expiry'],
        msg: 'must be a uint64 (must match /^[0-9]+$/)',
      },
    ],
  },
  {
    name: 'expiry-wrong-sign',
    json: `{
      "destination": "https://a.test",
      "expiry": "-1"
    }`,
    expectedErrors: [
      {
        path: ['expiry'],
        msg: 'must be a uint64 (must match /^[0-9]+$/)',
      },
    ],
  },
  {
    name: 'expiry-integer-wrong-sign',
    json: `{
      "destination": "https://a.test",
      "expiry": -1
    }`,
    expectedErrors: [
      {
        path: ['expiry'],
        msg: 'must be non-negative',
      },
    ],
  },
  {
    name: 'expiry-integer-clamp-min',
    json: `{
      "destination": "https://a.test",
      "expiry": 1
    }`,
    expectedWarnings: [
      {
        path: ['expiry'],
        msg: 'will be clamped to min of 86400',
      },
    ],
  },
  {
    name: 'expiry-integer-clamp-max',
    json: `{
      "destination": "https://a.test",
      "expiry": 2592001
    }`,
    expectedWarnings: [
      {
        path: ['expiry'],
        msg: 'will be clamped to max of 2592000',
      },
    ],
  },
  {
    name: 'expiry-string-clamp-min',
    json: `{
      "destination": "https://a.test",
      "expiry": "1"
    }`,
    expectedWarnings: [
      {
        path: ['expiry'],
        msg: 'will be clamped to min of 86400',
      },
    ],
  },
  {
    name: 'expiry-string-clamp-max',
    json: `{
      "destination": "https://a.test",
      "expiry": "2592001"
    }`,
    expectedWarnings: [
      {
        path: ['expiry'],
        msg: 'will be clamped to max of 2592000',
      },
    ],
  },
  {
    name: 'expiry-string-rounding-<-half-day',
    json: `{
      "destination": "https://a.test",
      "expiry": "129599"
    }`,
    sourceType: SourceType.event,
    expectedWarnings: [
      {
        path: ['expiry'],
        msg: 'will be rounded to nearest day (86400) as source type is event',
      },
    ],
  },
  {
    name: 'expiry-string-rounding-=-half-day',
    json: `{
      "destination": "https://a.test",
      "expiry": "129600"
    }`,
    sourceType: SourceType.event,
    expectedWarnings: [
      {
        path: ['expiry'],
        msg: 'will be rounded to nearest day (172800) as source type is event',
      },
    ],
  },
  {
    name: 'expiry-string-rounding->-half-day',
    json: `{
      "destination": "https://a.test",
      "expiry": "129601"
    }`,
    sourceType: SourceType.event,
    expectedWarnings: [
      {
        path: ['expiry'],
        msg: 'will be rounded to nearest day (172800) as source type is event',
      },
    ],
  },
  {
    name: 'expiry-integer-rounding-<-half-day',
    json: `{
      "destination": "https://a.test",
      "expiry": 129599
    }`,
    sourceType: SourceType.event,
    expectedWarnings: [
      {
        path: ['expiry'],
        msg: 'will be rounded to nearest day (86400) as source type is event',
      },
    ],
  },
  {
    name: 'expiry-integer-rounding-=-half-day',
    json: `{
      "destination": "https://a.test",
      "expiry": 129600
    }`,
    sourceType: SourceType.event,
    expectedWarnings: [
      {
        path: ['expiry'],
        msg: 'will be rounded to nearest day (172800) as source type is event',
      },
    ],
  },
  {
    name: 'expiry-integer-rounding->-half-day',
    json: `{
      "destination": "https://a.test",
      "expiry": 129601
    }`,
    sourceType: SourceType.event,
    expectedWarnings: [
      {
        path: ['expiry'],
        msg: 'will be rounded to nearest day (172800) as source type is event',
      },
    ],
  },
  {
    name: 'expiry-integer-no-rounding-navigation-source',
    json: `{
      "destination": "https://a.test",
      "expiry": 129601
    }`,
    sourceType: SourceType.navigation,
  },

  {
    name: 'debug-reporting-wrong-type',
    json: `{
      "destination": "https://a.test",
      "debug_reporting": "true"
    }`,
    expectedErrors: [
      {
        path: ['debug_reporting'],
        msg: 'must be a boolean',
      },
    ],
  },

  {
    name: 'max-event-level-reports-wrong-type',
    json: `{
      "destination": "https://a.test",
      "max_event_level_reports": "2"
    }`,
    expectedErrors: [
      {
        path: ['max_event_level_reports'],
        msg: 'must be a number',
      },
    ],
  },
  {
    name: 'max-event-level-reports-exceed-max',
    json: `{
      "destination": "https://a.test",
      "max_event_level_reports": 21
    }`,
    expectedErrors: [
      {
        path: ['max_event_level_reports'],
        msg: 'must be in the range [0, 20]',
      },
    ],
  },
  {
    name: 'event-level-report-windows-and-window',
    json: `{
      "destination": "https://a.test",
      "event_report_window": "3601",
      "event_report_windows": {
        "end_times": [3601]
      }
    }`,
    expectedErrors: [
      {
        path: [],
        msg: 'mutually exclusive fields: event_report_window, event_report_windows',
      },
    ],
  },
  {
    name: 'event-level-report-windows-no-end-times',
    json: `{
      "destination": "https://a.test",
      "event_report_windows": {
      }
    }`,
    expectedErrors: [
      {
        path: ['event_report_windows', 'end_times'],
        msg: 'required',
      },
    ],
  },
  {
    name: 'event-level-report-windows-empty-end-times',
    json: `{
      "destination": "https://a.test",
      "event_report_windows": {
        "end_times": []
      }
    }`,
    expectedErrors: [
      {
        path: ['event_report_windows', 'end_times'],
        msg: 'length must be in the range [1, 5]',
      },
    ],
  },
  {
    name: 'event-level-report-windows-excessive-end-times',
    json: `{
      "destination": "https://a.test",
      "event_report_windows": {
        "end_times": [3601,3602,3603,3604,3605,3606]
      }
    }`,
    expectedErrors: [
      {
        path: ['event_report_windows', 'end_times'],
        msg: 'length must be in the range [1, 5]',
      },
    ],
  },
  {
    name: 'event-level-report-windows-start-time',
    json: `{
      "destination": "https://a.test",
      "event_report_windows": {
        "start_time": 10,
        "end_times": [3611,3612,3613]
      }
    }`,
  },
  {
    name: 'event-level-report-windows-start-time-wrong-type',
    json: `{
      "destination": "https://a.test",
      "event_report_windows": {
        "start_time": "10",
        "end_times": [3611,3612,3613,3614]
      }
    }`,
    expectedErrors: [
      {
        path: ['event_report_windows', 'start_time'],
        msg: 'must be a number',
      },
      {
        path: ['event_report_windows', 'end_times'],
        msg: 'cannot be fully validated without a valid start_time',
      },
    ],
  },
  {
    name: 'event-level-report-windows-start-time-not-integer',
    json: `{
      "destination": "https://a.test",
      "event_report_windows": {
        "start_time": 10.5,
        "end_times": [3611,3612,3613,3614]
      }
    }`,
    expectedErrors: [
      {
        path: ['event_report_windows', 'start_time'],
        msg: 'must be an integer',
      },
      {
        path: ['event_report_windows', 'end_times'],
        msg: 'cannot be fully validated without a valid start_time',
      },
    ],
  },
  {
    name: 'event-level-report-windows-start-time-negative',
    json: `{
      "destination": "https://a.test",
      "event_report_windows": {
        "start_time": -1,
        "end_times": [3611,3612,3613,3614]
      }
    }`,
    expectedErrors: [
      {
        path: ['event_report_windows', 'start_time'],
        msg: 'must be non-negative and <= expiry (2592000)',
      },
      {
        path: ['event_report_windows', 'end_times'],
        msg: 'cannot be fully validated without a valid start_time',
      },
    ],
  },
  {
    name: 'event-level-report-windows-start-time-after-expiry',
    json: `{
      "destination": "https://a.test",
      "expiry": 259200,
      "event_report_windows": {
        "start_time": 259201
      }
    }`,
    expectedErrors: [
      {
        path: ['event_report_windows', 'start_time'],
        msg: 'must be non-negative and <= expiry (259200)',
      },
      {
        path: ['event_report_windows', 'end_times'],
        msg: 'required',
      },
    ],
  },
  {
    name: 'event-level-report-windows-end-time-<-start-time',
    json: `{
      "destination": "https://a.test",
      "event_report_windows": {
        "start_time": 3601,
        "end_times": [3600]
      }
    }`,
    expectedErrors: [
      {
        path: ['event_report_windows', 'end_times', 0],
        msg: 'must be > start_time (3601)',
      },
    ],
  },
  {
    name: 'event-level-report-windows-end-time-=-start-time',
    json: `{
      "destination": "https://a.test",
      "event_report_windows": {
        "start_time": 3601,
        "end_times": [3601]
      }
    }`,
    expectedErrors: [
      {
        path: ['event_report_windows', 'end_times', 0],
        msg: 'must be > start_time (3601)',
      },
    ],
  },
  {
    name: 'event-level-report-windows-end-times-=',
    json: `{
      "destination": "https://a.test",
      "event_report_windows": {
        "end_times": [3601, 3601, 3602]
      }
    }`,
    expectedErrors: [
      {
        path: ['event_report_windows', 'end_times', 1],
        msg: 'must be > previous end_time (3601)',
      },
    ],
  },
  {
    name: 'event-level-report-windows-end-times-<',
    json: `{
      "destination": "https://a.test",
      "event_report_windows": {
        "end_times": [3602, 3601, 3603]
      }
    }`,
    expectedErrors: [
      {
        path: ['event_report_windows', 'end_times', 1],
        msg: 'must be > previous end_time (3602)',
      },
    ],
  },
  {
    name: 'event-level-report-windows-end-times-clamp-min',
    json: `{
      "destination": "https://a.test",
      "event_report_windows": {
        "end_times": [3599]
      }
    }`,
    expectedWarnings: [
      {
        path: ['event_report_windows', 'end_times', 0],
        msg: 'will be clamped to min of 3600',
      },
    ],
  },
  {
    name: 'event-level-report-windows-end-times-clamp-max',
    json: `{
      "destination": "https://a.test",
      "expiry": 259200,
      "event_report_windows": {
        "end_times": [259201]
      }
    }`,
    expectedWarnings: [
      {
        path: ['event_report_windows', 'end_times', 0],
        msg: 'will be clamped to max of 259200 (expiry)',
      },
    ],
  },

  {
    name: 'channel-capacity-default-event',
    json: `{"destination": "https://a.test"}`,
    sourceType: SourceType.event,
    vsv: {
      maxEventLevelChannelCapacityPerSource: {
        [SourceType.event]: 0,
        [SourceType.navigation]: Infinity,
      },
      randomizedResponseEpsilon: 14,
    },
    expectedErrors: [
      {
        path: [],
        msg: 'exceeds max event-level channel capacity per event source (1.58 > 0.00)',
      },
    ],
  },
  {
    name: 'channel-capacity-default-navigation',
    json: `{"destination": "https://a.test"}`,
    sourceType: SourceType.navigation,
    vsv: {
      maxEventLevelChannelCapacityPerSource: {
        [SourceType.event]: Infinity,
        [SourceType.navigation]: 0,
      },
      randomizedResponseEpsilon: 14,
    },
    expectedErrors: [
      {
        path: [],
        msg: 'exceeds max event-level channel capacity per navigation source (11.46 > 0.00)',
      },
    ],
  },

  // Full Flex
  // TODO: compare returned trigger specs against expected values

  {
    name: 'trigger-specs-wrong-type',
    json: `{
      "destination": "https://a.test",
      "trigger_specs": {}
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs'],
        msg: 'must be a list',
      },
    ],
  },
  {
    name: 'trigger-specs-too-long',
    json: JSON.stringify({
      destination: 'https://a.test',
      trigger_specs: Array(33)
        .fill(null)
        .map((_, i) => ({ trigger_data: [i] })),
    }),
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs'],
        msg: 'length must be in the range [0, 32]',
      },
    ],
  },
  {
    name: 'trigger-specs-value-wrong-type',
    json: `{
      "destination": "https://a.test",
      "trigger_specs": [false]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs', 0],
        msg: 'must be an object',
      },
    ],
  },
  {
    name: 'trigger-data-missing',
    json: `{
      "destination": "https://a.test",
      "trigger_specs": [{}]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs', 0, 'trigger_data'],
        msg: 'required',
      },
    ],
  },
  {
    name: 'trigger-data-wrong-type',
    json: `{
      "destination": "https://a.test",
      "trigger_specs": [{"trigger_data": 1}]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs', 0, 'trigger_data'],
        msg: 'must be a list',
      },
    ],
  },
  {
    name: 'trigger-data-value-wrong-type',
    json: `{
      "destination": "https://a.test",
      "trigger_specs": [{"trigger_data": ["1"]}]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs', 0, 'trigger_data', 0],
        msg: 'must be a number',
      },
    ],
  },
  {
    name: 'trigger-data-value-not-integer',
    json: `{
      "destination": "https://a.test",
      "trigger_specs": [{"trigger_data": [1.5]}]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs', 0, 'trigger_data', 0],
        msg: 'must be an integer',
      },
    ],
  },
  {
    name: 'trigger-data-value-negative',
    json: `{
      "destination": "https://a.test",
      "trigger_specs": [{"trigger_data": [-1]}]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs', 0, 'trigger_data', 0],
        msg: 'must be in the range [0, 4294967295]',
      },
    ],
  },
  {
    name: 'trigger-data-value-exceeds-max',
    json: `{
      "destination": "https://a.test",
      "trigger_specs": [{"trigger_data": [4294967296]}]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs', 0, 'trigger_data', 0],
        msg: 'must be in the range [0, 4294967295]',
      },
    ],
  },
  {
    name: 'trigger-data-duplicated-within',
    json: `{
      "destination": "https://a.test",
      "trigger_specs": [
        { "trigger_data": [1, 2, 1] }
      ]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs', 0, 'trigger_data', 2],
        msg: 'duplicate value 1',
      },
    ],
  },
  {
    name: 'trigger-data-duplicated-across',
    json: `{
      "destination": "https://a.test",
      "trigger_specs": [
        { "trigger_data": [1, 2] },
        { "trigger_data": [3, 2] }
      ]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs'],
        msg: 'duplicate trigger_data: 2',
      },
    ],
  },
  {
    name: 'trigger-data-too-many-within',
    json: JSON.stringify({
      destination: 'https://a.test',
      trigger_specs: [
        {
          trigger_data: Array(33)
            .fill(0)
            .map((_, i) => i),
        },
      ],
    }),
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs', 0, 'trigger_data'],
        msg: 'length must be in the range [1, 32]',
      },
    ],
  },
  {
    name: 'trigger-data-too-many-across',
    json: JSON.stringify({
      destination: 'https://a.test',
      trigger_specs: [
        { trigger_data: [0] },
        {
          trigger_data: Array(32)
            .fill(0)
            .map((_, i) => i + 1),
        },
      ],
    }),
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs'],
        msg: 'exceeds maximum number of distinct trigger_data (33 > 32)',
      },
    ],
  },
  {
    name: 'summary-buckets-wrong-type',
    json: `{
      "destination": "https://a.test",
      "trigger_specs": [{
        "trigger_data": [3],
        "summary_buckets": 1
      }]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs', 0, 'summary_buckets'],
        msg: 'must be a list',
      },
    ],
  },
  {
    name: 'summary-buckets-empty',
    json: `{
      "destination": "https://a.test",
      "trigger_specs": [{
        "trigger_data": [3],
        "summary_buckets": []
      }]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs', 0, 'summary_buckets'],
        msg: 'length must be in the range [1, Infinity]',
      },
    ],
  },
  {
    name: 'summary-buckets-value-wrong-type',
    json: `{
      "destination": "https://a.test",
      "trigger_specs": [{
        "trigger_data": [3],
        "summary_buckets": ["1"]
      }]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs', 0, 'summary_buckets', 0],
        msg: 'must be a number',
      },
    ],
  },
  {
    name: 'summary-buckets-value-not-integer',
    json: `{
      "destination": "https://a.test",
      "trigger_specs": [{
        "trigger_data": [3],
        "summary_buckets": [1.5]
      }]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs', 0, 'summary_buckets', 0],
        msg: 'must be an integer',
      },
    ],
  },
  {
    name: 'summary-buckets-value-non-positive',
    json: `{
      "destination": "https://a.test",
      "trigger_specs": [{
        "trigger_data": [3],
        "summary_buckets": [0]
      }]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs', 0, 'summary_buckets', 0],
        msg: 'must be > implicit minimum (0) and <= uint32 max (4294967295)',
      },
    ],
  },
  {
    name: 'summary-buckets-non-increasing',
    json: `{
      "destination": "https://a.test",
      "trigger_specs": [{
        "trigger_data": [3],
        "summary_buckets": [5, 6, 4]
      }]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs', 0, 'summary_buckets', 2],
        msg: 'must be > previous value (6) and <= uint32 max (4294967295)',
      },
    ],
  },
  {
    name: 'summary-buckets-value-exceeds-max',
    json: `{
      "destination": "https://a.test",
      "trigger_specs": [{
        "trigger_data": [3],
        "summary_buckets": [4294967296]
      }]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs', 0, 'summary_buckets', 0],
        msg: 'must be > implicit minimum (0) and <= uint32 max (4294967295)',
      },
    ],
  },
  {
    name: 'summary-window-operator-wrong-type',
    json: `{
      "destination": "https://a.test",
      "trigger_specs": [{
        "trigger_data": [3],
        "summary_window_operator": 4
      }]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs', 0, 'summary_window_operator'],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'summary-window-operator-wrong-value',
    json: `{
      "destination": "https://a.test",
      "trigger_specs": [{
        "trigger_data": [3],
        "summary_window_operator": "VALUE_SUM"
      }]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs', 0, 'summary_window_operator'],
        msg: 'must be one of the following (case-sensitive): count, value_sum',
      },
    ],
  },
  {
    // The parser is shared with top-level event_report_windows, so just test
    // basic support here.
    name: 'spec-event-windows-basic',
    json: `{
      "destination": "https://a.test",
      "trigger_specs": [{
        "trigger_data": [3],
        "event_report_windows": {}
      }]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs', 0, 'event_report_windows', 'end_times'],
        msg: 'required',
      },
    ],
  },
  {
    name: 'trigger-data-matching-wrong-type',
    json: `{
      "destination": "https://a.test",
      "trigger_data_matching": 3
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_data_matching'],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'trigger-data-matching-wrong-value',
    json: `{
      "destination": "https://a.test",
      "trigger_data_matching": "EXACT"
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_data_matching'],
        msg: 'must be one of the following (case-sensitive): exact, modulus',
      },
    ],
  },
  {
    name: 'trigger-data-matching-modulus-trigger-data-start-not-0',
    json: `{
      "destination": "https://a.test",
      "trigger_data_matching": "modulus",
      "trigger_specs": [{"trigger_data": [1]}]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_data_matching'],
        msg: 'trigger_data must form a contiguous sequence of integers starting at 0 for modulus',
      },
    ],
  },
  {
    name: 'trigger-data-matching-modulus-trigger-data-not-contiguous',
    json: `{
      "destination": "https://a.test",
      "trigger_data_matching": "modulus",
      "trigger_specs": [
        {"trigger_data": [0, 1]},
        {"trigger_data": [3]}
      ]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_data_matching'],
        msg: 'trigger_data must form a contiguous sequence of integers starting at 0 for modulus',
      },
    ],
  },
  {
    name: 'trigger-data-matching-modulus-valid',
    json: `{
      "destination": "https://a.test",
      "trigger_data_matching": "modulus",
      "trigger_specs": [
        {"trigger_data": [1, 0]},
        {"trigger_data": [3]},
        {"trigger_data": [2]}
      ]
    }`,
    parseFullFlex: true,
  },
]

testCases.forEach((tc) =>
  jsontest.run(tc, () =>
    validateSource(
      tc.json,
      { ...vsv.Chromium, ...tc.vsv },
      tc.sourceType ?? SourceType.navigation,
      tc.parseFullFlex ?? false
    )
  )
)
