import { Maybe } from './maybe'
import { Source, SourceType, validateSource } from './validate-json'
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
      eventReportWindow: {
        startTime: 0,
        endTimes: [3601],
      },
      expiry: 86400,
      filterData: new Map([['b', new Set(['c'])]]),
      priority: 2n,
      sourceEventId: 3n,
      maxEventLevelReports: 2,
    }),
  },

  // warnings
  {
    name: 'unknown-field',
    json: `{
      "destination": "https://a.test",
      "x": true
    }`,
    expectedWarnings: [
      {
        path: ['x'],
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
        "a": "0x1",
        "b": "0x2"
      }
    }`,
    vsv: { maxAggregationKeysPerAttribution: 1 },
    expectedErrors: [
      {
        path: ['aggregation_keys'],
        msg: 'exceeds the maximum number of keys (1)',
      },
    ],
  },

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
        "end_times": [3611,3612,3613,3614]
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
        path: ['event_report_windows', 'end_times', 0],
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
        path: ['event_report_windows', 'end_times', 0],
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
        path: ['event_report_windows', 'end_times', 0],
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
]

testCases.forEach((tc) =>
  jsontest.run(tc, () =>
    validateSource(
      tc.json,
      tc.vsv ?? {},
      tc.sourceType ?? SourceType.navigation
    )
  )
)
