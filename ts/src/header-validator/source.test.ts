import { strict as assert } from 'assert'
import { SourceType } from '../source-type'
import * as vsv from '../vendor-specific-values'
import { Maybe } from './maybe'
import { serializeSource } from './to-json'
import {
  Source,
  SummaryWindowOperator,
  TriggerDataMatching,
  validateSource,
} from './validate-json'
import * as jsontest from './validate-json.test'

type TestCase = jsontest.TestCase<Source> & {
  sourceType?: SourceType
  noteInfoGain?: boolean
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
      "destination_limit_priority": "1",
      "event_report_window": "3601",
      "expiry": "86400",
      "filter_data": {"b": ["c"]},
      "priority": "2",
      "source_event_id": "3",
      "max_event_level_reports": 2,
      "aggregatable_debug_reporting": {
        "budget": 1234,
        "key_piece": "0x2",
        "debug_data": [ {
          "key_piece": "0x1",
          "types": ["source-success"],
          "value": 123
        } ]
      },
      "attribution_scope_limit": 3,
      "attribution_scopes": ["1"],
      "max_event_states": 4
    }`,
    sourceType: SourceType.navigation,
    expected: Maybe.some({
      aggregatableReportWindow: 3601,
      aggregationKeys: new Map([['a', 15n]]),
      debugKey: 1n,
      debugReporting: true,
      destination: new Set(['https://a.test']),
      destinationLimitPriority: 1n,
      eventLevelEpsilon: 14,
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
      aggregatableDebugReporting: {
        budget: 1234,
        keyPiece: 2n,
        debugData: [
          {
            keyPiece: 1n,
            types: new Set(['source-success']),
            value: 123,
          },
        ],
        aggregationCoordinatorOrigin:
          'https://publickeyservice.msmt.aws.privacysandboxservices.com',
      },
      attributionScopeLimit: 3,
      attributionScopes: new Set<string>('1'),
      maxEventStates: 4,
    }),
  },

  // warnings
  {
    name: 'unknown-field',
    json: `{
      "destination": "https://a.test",
      "x": []
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
    json: `{"destination": ["https://a.test/b?c=d#e", "https://x.Y.test", "https://sub.A.test/z"]}`,
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
    name: 'destination-list-empty',
    json: `{"destination": []}`,
    expectedErrors: [
      {
        path: ['destination'],
        msg: 'length must be in the range [1, 3]',
      },
    ],
  },
  {
    name: 'destination-list-too-long',
    json: `{"destination": [
      "https://a.test",
      "https://b.test/1",
      "https://b.test/2",
      "https://c.test/3"
    ]}`,
    expectedErrors: [
      {
        path: ['destination'],
        msg: 'length must be in the range [1, 3]',
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
  {
    name: 'filter-data-too-many-keys',
    json: JSON.stringify({
      destination: 'https://a.test',
      filter_data: Object.fromEntries(
        Array.from({ length: 51 }, (_, i) => [`k${i}`, []])
      ),
    }),
    expectedErrors: [
      {
        path: ['filter_data'],
        msg: 'exceeds the maximum number of keys (50)',
      },
    ],
  },
  {
    name: 'filter-data-too-many-values',
    json: JSON.stringify({
      destination: 'https://a.test',
      filter_data: { a: Array.from({ length: 51 }, () => '') },
    }),
    expectedErrors: [
      {
        path: ['filter_data', 'a'],
        msg: 'length must be in the range [0, 50]',
      },
    ],
  },

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
  {
    name: 'aggregation-keys-too-many-keys',
    json: JSON.stringify({
      destination: 'https://a.test',
      aggregation_keys: Object.fromEntries(
        Array.from({ length: 21 }, (_, i) => [`k${i}`, '0x1'])
      ),
    }),
    expectedErrors: [
      {
        path: ['aggregation_keys'],
        msg: 'exceeds the maximum number of keys (20)',
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
        msg: 'string must represent a non-negative integer (must match /^[0-9]+$/)',
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
        msg: 'string must represent a non-negative integer (must match /^[0-9]+$/)',
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
        msg: 'string must represent an integer (must match /^-?[0-9]+$/)',
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
        msg: 'string must represent a non-negative integer (must match /^[0-9]+$/)',
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
        msg: 'string must represent a non-negative integer (must match /^[0-9]+$/)',
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
        msg: 'string must represent a non-negative integer (must match /^[0-9]+$/)',
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
        msg: 'string must represent a non-negative integer (must match /^[0-9]+$/)',
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
        msg: 'string must represent a non-negative integer (must match /^[0-9]+$/)',
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
        msg: 'string must represent a non-negative integer (must match /^[0-9]+$/)',
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
    name: 'destination-limit-priority-wrong-type',
    json: `{
      "destination": "https://a.test",
      "destination_limit_priority": 1
    }`,
    expectedErrors: [
      {
        path: ['destination_limit_priority'],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'destination-limit-priority-wrong-format',
    json: `{
      "destination": "https://a.test",
      "destination_limit_priority": "x"
    }`,
    expectedErrors: [
      {
        path: ['destination_limit_priority'],
        msg: 'string must represent an integer (must match /^-?[0-9]+$/)',
      },
    ],
  },

  {
    name: 'channel-capacity-default-event',
    json: `{"destination": "https://a.test"}`,
    sourceType: SourceType.event,
    noteInfoGain: true,
    vsv: {
      maxEventLevelChannelCapacityPerSource: {
        [SourceType.event]: 0,
        [SourceType.navigation]: Infinity,
      },
      maxSettableEventLevelEpsilon: 14,
    },
    expectedErrors: [
      {
        path: [],
        msg: 'information gain: 1.58 exceeds max event-level channel capacity per event source (0.00)',
      },
    ],
    expectedNotes: [
      {
        path: [],
        msg: 'number of possible output states: 3',
      },
      {
        path: [],
        msg: 'randomized trigger rate: 0.0000025',
      },
    ],
  },
  {
    name: 'channel-capacity-default-navigation',
    json: `{"destination": "https://a.test"}`,
    sourceType: SourceType.navigation,
    noteInfoGain: true,
    vsv: {
      maxEventLevelChannelCapacityPerSource: {
        [SourceType.event]: Infinity,
        [SourceType.navigation]: 0,
      },
      maxSettableEventLevelEpsilon: 14,
    },
    expectedErrors: [
      {
        path: [],
        msg: 'information gain: 11.46 exceeds max event-level channel capacity per navigation source (0.00)',
      },
    ],
    expectedNotes: [
      {
        path: [],
        msg: 'number of possible output states: 2925',
      },
      {
        path: [],
        msg: 'randomized trigger rate: 0.0024263',
      },
    ],
  },

  {
    name: 'trigger-state-cardinality-valid',
    json: `{"destination": "https://a.test"}`,
    sourceType: SourceType.event,
    vsv: {
      maxEventLevelChannelCapacityPerSource: {
        [SourceType.event]: Infinity,
        [SourceType.navigation]: 0,
      },
      maxSettableEventLevelEpsilon: 14,
      maxTriggerStateCardinality: 3,
    },
  },
  {
    name: 'trigger-state-cardinality-invalid',
    json: `{
      "destination": "https://a.test",
      "attribution_scope_limit": 3,
      "attribution_scopes": ["1"],
      "max_event_states": 2
    }`,
    sourceType: SourceType.event,
    vsv: {
      maxEventLevelChannelCapacityPerSource: {
        [SourceType.event]: Infinity,
        [SourceType.navigation]: 0,
      },
      maxSettableEventLevelEpsilon: 14,
      maxTriggerStateCardinality: 2,
    },
    expectedErrors: [
      {
        path: [],
        msg: 'number of possible output states (3) exceeds max cardinality (2)',
      },
      {
        path: [],
        msg: 'number of possible output states (3) exceeds max event states (2)',
      },
    ],
  },

  {
    name: 'event-level-epsilon-valid',
    json: `{
      "destination": "https://a.test",
      "event_level_epsilon": 13.5
    }`,
  },
  {
    name: 'event-level-epsilon-wrong-type',
    json: `{
      "destination": "https://a.test",
      "event_level_epsilon": "1"
    }`,
    expectedErrors: [
      {
        path: ['event_level_epsilon'],
        msg: 'must be a number',
      },
    ],
  },
  {
    name: 'event-level-epsilon-negative',
    json: `{
      "destination": "https://a.test",
      "event_level_epsilon": -1
    }`,
    expectedErrors: [
      {
        path: ['event_level_epsilon'],
        msg: 'must be in the range [0, 14]',
      },
    ],
  },
  {
    name: 'event-level-epsilon-above-max',
    json: `{
      "destination": "https://a.test",
      "event_level_epsilon": 14.1
    }`,
    expectedErrors: [
      {
        path: ['event_level_epsilon'],
        msg: 'must be in the range [0, 14]',
      },
    ],
  },

  {
    name: 'aggregatable-debug-reporting-wrong-type',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": 1
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting'],
        msg: 'must be an object',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-empty',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {}
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'budget'],
        msg: 'required',
      },
      {
        path: ['aggregatable_debug_reporting', 'key_piece'],
        msg: 'required',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-budget-wrong-type',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": "1",
        "key_piece": "0x1"
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'budget'],
        msg: 'must be a number',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-budget-below-min',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 0,
        "key_piece": "0x1"
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'budget'],
        msg: 'must be in the range [1, 65536]',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-budget-above-max',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 65537,
        "key_piece": "0x1"
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'budget'],
        msg: 'must be in the range [1, 65536]',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-key-piece-wrong-type',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 123,
        "key_piece": 1
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'key_piece'],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-key-piece-wrong-format',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 123,
        "key_piece": "1"
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'key_piece'],
        msg: 'must be a hex128 (must match /^0[xX][0-9A-Fa-f]{1,32}$/)',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-aggregation-coordinator-origin-wrong-format',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 123,
        "key_piece": "0x1",
        "aggregation_coordinator_origin": 1
      }
    }`,
    expectedErrors: [
      {
        path: [
          'aggregatable_debug_reporting',
          'aggregation_coordinator_origin',
        ],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-aggregation-coordinator-origin-not-url',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 123,
        "key_piece": "0x1",
        "aggregation_coordinator_origin": "a.test"
      }
    }`,
    expectedErrors: [
      {
        path: [
          'aggregatable_debug_reporting',
          'aggregation_coordinator_origin',
        ],
        msg: 'invalid URL',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-aggregation-coordinator-origin-untrustworthy',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 123,
        "key_piece": "0x1",
        "aggregation_coordinator_origin": "http://a.test"
      }
    }`,
    expectedErrors: [
      {
        path: [
          'aggregatable_debug_reporting',
          'aggregation_coordinator_origin',
        ],
        msg: 'URL must use HTTP/HTTPS and be potentially trustworthy',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-data-wrong-type',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 123,
        "key_piece": "0x1",
        "debug_data": {}
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'debug_data'],
        msg: 'must be a list',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-data-elem-wrong-type',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 123,
        "key_piece": "0x1",
        "debug_data": [1]
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'debug_data', 0],
        msg: 'must be an object',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-data-elem-empty',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 123,
        "key_piece": "0x1",
        "debug_data": [{}]
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'debug_data', 0, 'types'],
        msg: 'required',
      },
      {
        path: ['aggregatable_debug_reporting', 'debug_data', 0, 'value'],
        msg: 'required',
      },
      {
        path: ['aggregatable_debug_reporting', 'debug_data', 0, 'key_piece'],
        msg: 'required',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-data-elem-key-piece-wrong-type',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 123,
        "key_piece": "0x1",
        "debug_data": [{
          "key_piece": 1,
          "types": ["source-success"],
          "value": 123
        }]
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'debug_data', 0, 'key_piece'],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-data-elem-key-piece-wrong-format',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 123,
        "key_piece": "0x1",
        "debug_data": [{
          "key_piece": "1",
          "types": ["source-success"],
          "value": 123
        }]
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'debug_data', 0, 'key_piece'],
        msg: 'must be a hex128 (must match /^0[xX][0-9A-Fa-f]{1,32}$/)',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-data-elem-value-wrong-type',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 123,
        "key_piece": "0x1",
        "debug_data": [{
          "key_piece": "0x1",
          "types": ["source-success"],
          "value": "1"
        }]
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'debug_data', 0, 'value'],
        msg: 'must be a number',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-data-elem-value-below-min',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 789,
        "key_piece": "0x1",
        "debug_data": [{
          "key_piece": "0x1",
          "types": ["source-success"],
          "value": 0 
        }]
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'debug_data', 0, 'value'],
        msg: 'must be in the range [1, 65536]',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-data-elem-value-above-max',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 789,
        "key_piece": "0x1",
        "debug_data": [{
          "key_piece": "0x1",
          "types": ["source-success"],
          "value": 65537 
        }]
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'debug_data', 0, 'value'],
        msg: 'must be in the range [1, 65536]',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-data-elem-value-above-budget',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 789,
        "key_piece": "0x1",
        "debug_data": [{
          "key_piece": "0x1",
          "types": ["source-success"],
          "value": 790
        }]
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting'],
        msg: 'data contains value greater than budget (789)',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-data-elem-types-wrong-type',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 123,
        "key_piece": "0x1",
        "debug_data": [{
          "key_piece": "0x1",
          "types": "1",
          "value": 123
        }]
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'debug_data', 0, 'types'],
        msg: 'must be a list',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-data-elem-types-empty',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 123,
        "key_piece": "0x1",
        "debug_data": [{
          "key_piece": "0x2",
          "types": [],
          "value": 123
        }]
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'debug_data', 0, 'types'],
        msg: 'length must be in the range [1, Infinity]',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-data-elem-types-elem-wrong-type',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 123,
        "key_piece": "0x1",
        "debug_data": [{
          "key_piece": "0x2",
          "types": [1],
          "value": 123
        }]
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'debug_data', 0, 'types', 0],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-data-elem-types-elem-unknown-duplicate',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 123,
        "key_piece": "0x1",
        "debug_data": [{
          "key_piece": "0x2",
          "types": ["abc", "abc"],
          "value": 123
        }]
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'debug_data', 0, 'types', 1],
        msg: 'duplicate value abc',
      },
    ],
    expectedWarnings: [
      {
        path: ['aggregatable_debug_reporting', 'debug_data', 0, 'types', 0],
        msg: 'unknown type',
      },
      {
        path: ['aggregatable_debug_reporting', 'debug_data', 0, 'types', 1],
        msg: 'unknown type',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-data-elem-types-elem-unknown-duplicate-across',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 123,
        "key_piece": "0x1",
        "debug_data": [{
          "key_piece": "0x2",
          "types": ["abc"],
          "value": 123
        }, {
          "key_piece": "0x1",
          "types": ["abc"],
          "value": 456
	}]
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'debug_data'],
        msg: 'duplicate type: abc',
      },
    ],
    expectedWarnings: [
      {
        path: ['aggregatable_debug_reporting', 'debug_data', 0, 'types', 0],
        msg: 'unknown type',
      },
      {
        path: ['aggregatable_debug_reporting', 'debug_data', 1, 'types', 0],
        msg: 'unknown type',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-data-elem-types-elem-duplicate',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 123,
        "key_piece": "0x1",
        "debug_data": [{
          "key_piece": "0x2",
          "types": ["source-success", "source-success"],
          "value": 123
        }]
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'debug_data', 0, 'types', 1],
        msg: 'duplicate value source-success',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-data-elem-types-elem-duplicate-across',
    json: `{
      "destination": "https://a.test",
      "aggregatable_debug_reporting": {
        "budget": 123,
        "key_piece": "0x1",
        "debug_data": [{
          "key_piece": "0x2",
          "types": ["unspecified"],
          "value": 123
        }, {
          "key_piece": "0x3",
          "types": ["unspecified"],
          "value": 123
        }]
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'debug_data'],
        msg: 'duplicate type: unspecified',
      },
    ],
  },

  // Flex
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
    name: 'top-level-trigger-data-and-trigger-specs',
    json: `{
      "destination": "https://a.test",
      "trigger_data": [],
      "trigger_specs": []
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: [],
        msg: 'mutually exclusive fields: trigger_data, trigger_specs',
      },
    ],
  },
  {
    name: 'top-level-trigger-data-and-trigger-specs-ignored',
    json: `{
      "destination": "https://a.test",
      "max_event_level_reports": 0,
      "trigger_data": [],
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
      "trigger_data": 1
    }`,
    expectedErrors: [
      {
        path: ['trigger_data'],
        msg: 'must be a list',
      },
    ],
  },
  {
    name: 'trigger-data-value-wrong-type',
    json: `{
      "destination": "https://a.test",
      "trigger_data": ["1"]
    }`,
    expectedErrors: [
      {
        path: ['trigger_data', 0],
        msg: 'must be a number',
      },
    ],
  },
  {
    name: 'trigger-data-value-not-integer',
    json: `{
      "destination": "https://a.test",
      "trigger_data": [1.5]
    }`,
    expectedErrors: [
      {
        path: ['trigger_data', 0],
        msg: 'must be an integer',
      },
    ],
  },
  {
    name: 'trigger-data-value-negative',
    json: `{
      "destination": "https://a.test",
      "trigger_data": [-1]
    }`,
    expectedErrors: [
      {
        path: ['trigger_data', 0],
        msg: 'must be in the range [0, 4294967295]',
      },
    ],
  },
  {
    name: 'trigger-data-value-exceeds-max',
    json: `{
      "destination": "https://a.test",
      "trigger_data": [4294967296]
    }`,
    expectedErrors: [
      {
        path: ['trigger_data', 0],
        msg: 'must be in the range [0, 4294967295]',
      },
    ],
  },
  {
    name: 'trigger-data-duplicated-within',
    json: `{
      "destination": "https://a.test",
      "trigger_data": [1, 2, 1]
    }`,
    expectedErrors: [
      {
        path: ['trigger_data', 2],
        msg: 'duplicate value 1',
      },
    ],
  },
  {
    name: 'trigger-data-too-many-within',
    json: JSON.stringify({
      destination: 'https://a.test',
      trigger_data: Array.from({ length: 33 }, () => 0),
    }),
    expectedErrors: [
      {
        path: ['trigger_data'],
        msg: 'length must be in the range [0, 32]',
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
    name: 'trigger-spec-trigger-data-empty',
    json: `{
      "destination": "https://a.test",
      "trigger_specs": [{"trigger_data": []}]
    }`,
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
        msg: 'length must be in the range [1, 3 (max_event_level_reports)]',
      },
    ],
  },
  {
    name: 'summary-buckets-too-long',
    json: `{
      "destination": "https://a.test",
      "max_event_level_reports": 4,
      "trigger_specs": [{
        "trigger_data": [3],
        "summary_buckets": [1, 2, 3, 4, 5]
      }]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['trigger_specs', 0, 'summary_buckets'],
        msg: 'length must be in the range [1, 4 (max_event_level_reports)]',
      },
    ],
  },
  {
    name: 'summary-buckets-cannot-validate-length',
    json: `{
      "destination": "https://a.test",
      "max_event_level_reports": null,
      "trigger_specs": [{
        "trigger_data": [3],
        "summary_buckets": [1, 2, 3, 4, 5]
      }]
    }`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['max_event_level_reports'],
        msg: 'must be a number',
      },
      {
        path: ['trigger_specs', 0, 'summary_buckets'],
        msg: 'cannot be fully validated without a valid max_event_level_reports',
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
      "trigger_data": [1]
    }`,
    expectedErrors: [
      {
        path: ['trigger_data_matching'],
        msg: 'trigger_data must form a contiguous sequence of integers starting at 0 for modulus',
      },
    ],
  },
  {
    name: 'trigger-data-matching-modulus-trigger-data-not-contiguous-across',
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
    name: 'trigger-data-matching-modulus-trigger-data-not-contiguous-within',
    json: `{
      "destination": "https://a.test",
      "trigger_data_matching": "modulus",
      "trigger_data": [0, 1, 3]
    }`,
    expectedErrors: [
      {
        path: ['trigger_data_matching'],
        msg: 'trigger_data must form a contiguous sequence of integers starting at 0 for modulus',
      },
    ],
  },
  {
    name: 'trigger-data-matching-defaulted-modulus-trigger-data-not-contiguous-within',
    json: `{
      "destination": "https://a.test",
      "trigger_data": [0, 1, 3]
    }`,
    expectedErrors: [
      {
        path: ['trigger_data_matching'],
        msg: 'trigger_data must form a contiguous sequence of integers starting at 0 for modulus',
      },
    ],
  },
  {
    name: 'trigger-data-matching-modulus-valid-across',
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
  {
    name: 'trigger-data-matching-modulus-valid-within',
    json: `{
      "destination": "https://a.test",
      "trigger_data_matching": "modulus",
      "trigger_data": [1, 0, 2, 3]
    }`,
  },

  {
    name: 'no-reports-but-specs',
    json: `{
      "destination": "https://a.test",
      "max_event_level_reports": 0,
      "trigger_data": [0]
    }`,
    expectedWarnings: [
      {
        path: [],
        msg: 'trigger_specs non-empty but event-level attribution will always fail because max_event_level_reports = 0',
      },
    ],
  },
  {
    name: 'reports-but-no-specs',
    json: `{
      "destination": "https://a.test",
      "max_event_level_reports": 1,
      "trigger_data": []
    }`,
    expectedWarnings: [
      {
        path: [],
        msg: 'max_event_level_reports > 0 but event-level attribution will always fail because trigger_specs is empty',
      },
    ],
  },

  // Attribution Scope
  {
    name: 'attribution-scope-limit-negative',
    json: `{
      "destination": "https://a.test",
      "attribution_scope_limit": -1
    }`,
    expectedErrors: [
      {
        path: ['attribution_scope_limit'],
        msg: 'must be in the range [1, 4294967295]',
      },
    ],
  },
  {
    name: 'attribution-scope-limit-zero',
    json: `{
      "destination": "https://a.test",
      "attribution_scope_limit": 0
    }`,
    expectedErrors: [
      {
        path: ['attribution_scope_limit'],
        msg: 'must be in the range [1, 4294967295]',
      },
    ],
  },
  {
    name: 'attribution-scope-limit-not-integer',
    json: `{
      "destination": "https://a.test",
      "attribution_scope_limit": 1.5
    }`,
    expectedErrors: [
      {
        path: ['attribution_scope_limit'],
        msg: 'must be an integer',
      },
    ],
  },
  {
    name: 'attribution-scope-limit-exceeds-max',
    json: `{
      "destination": "https://a.test",
      "attribution_scope_limit": 4294967296
    }`,
    expectedErrors: [
      {
        path: ['attribution_scope_limit'],
        msg: 'must be in the range [1, 4294967295]',
      },
    ],
  },
  {
    name: 'empty-attribution-scopes-with-limit',
    json: `{
      "destination": "https://a.test",
      "attribution_scope_limit": 3,
      "attribution_scopes": []
    }`,
    expectedErrors: [
      {
        path: ['attribution_scopes'],
        msg: 'length must be in the range [1, 3]',
      },
    ],
  },
  {
    name: 'missing-attribution-scope-limit-attribution-scopes',
    json: `{
      "destination": "https://a.test",
      "attribution_scopes": ["1", "2"]
    }`,
    expectedErrors: [
      {
        path: ['attribution_scopes'],
        msg: 'length must be in the range [0, 0]',
      },
    ],
  },
  {
    name: 'missing-attribution-scope-limit-max-event-states',
    json: `{
      "destination": "https://a.test",
      "max_event_states": 5
    }`,
    expectedErrors: [
      {
        path: ['max_event_states'],
        msg: 'non-default max_event_states when attribution_scope_limit is not set',
      },
    ],
  },
  {
    name: 'max-event-states-negative',
    json: `{
      "destination": "https://a.test",
      "attribution_scope_limit": 1,
      "max_event_states": -1
    }`,
    expectedErrors: [
      {
        path: ['max_event_states'],
        msg: 'must be in the range [1, Infinity]',
      },
    ],
  },
  {
    name: 'max-event-states-zero',
    json: `{
      "destination": "https://a.test",
      "attribution_scope_limit": 1,
      "max_event_states": 0
    }`,
    expectedErrors: [
      {
        path: ['max_event_states'],
        msg: 'must be in the range [1, Infinity]',
      },
    ],
  },
  {
    name: 'max-event-states-not-integer',
    json: `{
      "destination": "https://a.test",
      "attribution_scope_limit": 1,
      "max_event_states": 1.5
    }`,
    expectedErrors: [
      {
        path: ['max_event_states'],
        msg: 'must be an integer',
      },
    ],
  },
  {
    name: 'attribution-scopes-size-exceeds-attribution-scope-limit',
    json: `{
      "destination": "https://a.test",
      "attribution_scope_limit": 1,
      "attribution_scopes": ["1", "2"]
    }`,
    expectedErrors: [
      {
        path: ['attribution_scopes'],
        msg: 'length must be in the range [1, 1]',
      },
    ],
  },
  {
    name: 'attribution-scope-not-string',
    json: `{
      "destination": "https://a.test",
      "attribution_scope_limit": 2,
      "attribution_scopes": [1]
    }`,
    expectedErrors: [
      {
        path: ['attribution_scopes', 0],
        msg: 'must be a string',
      },
      {
        path: ['attribution_scopes', 1],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'attribution-scopes-empty-list',
    json: `{
      "destination": "https://a.test",
      "attribution_scopes": []
    }`,
  },
  {
    name: 'attribution-scopes-not-list',
    json: `{
      "destination": "https://a.test",
      "attribution_scope_limit": 1,
      "attribution_scopes": 1
    }`,
    expectedErrors: [
      {
        msg: 'must be a list',
        path: ['attribution_scopes'],
      },
    ],
  },
  {
    name: 'attribution-scopes-too-many',
    json: `{
      "destination": "https://a.test",
      "attribution_scope_limit": 21,
      "attribution_scopes": ["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21"]
    }`,
    expectedErrors: [
      {
        path: ['attribution_scopes'],
        msg: 'length must be in the range [1, 20]',
      },
    ],
  },
  {
    name: 'attribution-scopes-too-long',
    json: `{
      "destination": "https://a.test",
      "attribution_scope_limit": 1,
      "attribution_scopes": ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]
    }`,
    expectedErrors: [
      {
        path: ['attribution_scopes', 0],
        msg: 'exceeds max length per attribution scope (51 > 50)',
      },
    ],
  },
]

testCases.forEach((tc) =>
  jsontest.run(tc, () => {
    const result = validateSource(
      tc.json,
      { ...vsv.Chromium, ...tc.vsv },
      tc.sourceType ?? SourceType.navigation,
      tc.parseFullFlex ?? false,
      tc.noteInfoGain ?? false
    )

    if (result[1].value !== undefined) {
      const str = JSON.stringify(
        serializeSource(result[1].value, tc.parseFullFlex ?? false)
      )
      const [, reparsed] = validateSource(
        str,
        { ...vsv.Chromium, ...tc.vsv },
        tc.sourceType ?? SourceType.navigation,
        tc.parseFullFlex ?? false,
        tc.noteInfoGain ?? false
      )
      assert.deepEqual(reparsed, result[1], str)
    }

    return result
  })
)
