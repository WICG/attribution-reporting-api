import * as vsv from '../vendor-specific-values'
import { Maybe } from './maybe'
import { AggregatableSourceRegistrationTime, Trigger } from './trigger'
import * as testutil from './util.test'
import * as jsontest from './validate-json.test'
import * as trigger from './validate-trigger'

const testCases: jsontest.TestCase<Trigger>[] = [
  // no errors or warnings
  {
    name: 'required-fields-only',
    input: `{}`,
  },
  {
    name: 'all-fields',
    input: `{
      "aggregatable_deduplication_keys": [{
        "deduplication_key": "123",
        "filters": {"x": []},
        "not_filters": {"y": []}
      }],
      "named_budgets": [{
        "name": "1",
        "filters": {"x": []},
        "not_filters": {"y": []}
      }],
      "aggregatable_source_registration_time": "include",
      "aggregatable_trigger_data": [{
        "filters": {"a": ["b"]},
        "key_piece": "0x1",
        "not_filters": {"c": ["d"]},
        "source_keys": ["x", "y"]
      }],
      "aggregatable_filtering_id_max_bytes": 1,
      "aggregatable_values": {"x": 5,  "y": {"value": 10, "filtering_id": "25" }},
      "debug_key": "5",
      "debug_reporting": true,
      "event_trigger_data": [{
        "deduplication_key": "123",
        "filters": {"e": []},
        "not_filters": {"y": []},
        "priority": "-7",
        "trigger_data": "1"
      }],
      "filters": {"f": []},
      "not_filters": {"g": []},
      "aggregatable_debug_reporting": {
        "key_piece": "0x1",
        "debug_data": [{
          "types": ["trigger-unknown-error"],
          "key_piece": "0x5",
          "value": 123
        }]
      },
      "attribution_scopes": ["1"]
    }`,
    parseNamedBudgets: true,
    expected: Maybe.some({
      aggregatableDedupKeys: [
        {
          dedupKey: 123n,
          positive: [
            {
              lookbackWindow: null,
              map: new Map([['x', new Set()]]),
            },
          ],
          negative: [
            {
              lookbackWindow: null,
              map: new Map([['y', new Set()]]),
            },
          ],
        },
      ],
      namedBudgets: [
        {
          name: '1',
          positive: [
            {
              lookbackWindow: null,
              map: new Map([['x', new Set()]]),
            },
          ],
          negative: [
            {
              lookbackWindow: null,
              map: new Map([['y', new Set()]]),
            },
          ],
        },
      ],
      aggregatableSourceRegistrationTime:
        AggregatableSourceRegistrationTime.include,
      aggregationCoordinatorOrigin:
        'https://publickeyservice.msmt.aws.privacysandboxservices.com',
      triggerContextID: null,
      aggregatableDebugReporting: {
        keyPiece: 1n,
        debugData: [
          {
            types: new Set(['trigger-unknown-error']),
            keyPiece: 5n,
            value: 123,
          },
        ],
        aggregationCoordinatorOrigin:
          'https://publickeyservice.msmt.aws.privacysandboxservices.com',
      },
      aggregatableTriggerData: [
        {
          positive: [
            {
              lookbackWindow: null,
              map: new Map([['a', new Set(['b'])]]),
            },
          ],
          keyPiece: 1n,
          negative: [
            {
              lookbackWindow: null,
              map: new Map([['c', new Set(['d'])]]),
            },
          ],
          sourceKeys: new Set(['x', 'y']),
        },
      ],
      aggregatableFilteringIdMaxBytes: 1,
      aggregatableValuesConfigurations: [
        {
          values: new Map([
            ['x', { value: 5, filteringId: 0n }],
            ['y', { value: 10, filteringId: 25n }],
          ]),
          positive: [],
          negative: [],
        },
      ],
      debugKey: 5n,
      debugReporting: true,
      eventTriggerData: [
        {
          dedupKey: 123n,
          priority: -7n,
          triggerData: 1n,
          positive: [
            {
              lookbackWindow: null,
              map: new Map([['e', new Set()]]),
            },
          ],
          negative: [
            {
              lookbackWindow: null,
              map: new Map([['y', new Set()]]),
            },
          ],
          value: 1,
        },
      ],
      positive: [
        {
          lookbackWindow: null,
          map: new Map([['f', new Set()]]),
        },
      ],
      negative: [
        {
          lookbackWindow: null,
          map: new Map([['g', new Set()]]),
        },
      ],
      attributionScopes: new Set('1'),
    }),
  },
  {
    name: 'aggregatable-values-list-with-filters',
    input: `{
      "aggregatable_values": [
        {
          "values": {},
          "filters": [{"g": []}, {"h": []}],
          "not_filters": [{"g": []}, {"h": []}]
        },
        {
          "values": {},
          "filters": [{"i": []}, {"j": []}],
          "not_filters": [{"i": []}, {"j": []}]
        }
      ]
    }`,
  },
  {
    name: 'missing-optional-filtering-id',
    input: `{
      "aggregatable_trigger_data": [{
        "key_piece": "0x1",
        "source_keys": ["a"]
      }],
      "aggregatable_values": {
        "a": { "value": 3 }
      }
    }`,
  },
  {
    name: 'or-filters',
    input: `{
      "aggregatable_trigger_data": [{
        "key_piece": "0x1",
        "filters": [{"g": []}, {"h": []}],
        "not_filters": [{"g": []}, {"h": []}]
      }],
      "event_trigger_data": [{
        "filters": [{"g": []}, {"h": []}],
        "not_filters": [{"g": []}, {"h": []}]
      }],
      "filters": [{"g": []}, {"h": []}],
      "not_filters": [{"g": []}, {"h": []}]
    }`,
  },
  {
    name: 'empty-or-filters',
    input: `{
      "aggregatable_trigger_data": [{
        "key_piece": "0x1",
        "filters": [],
        "not_filters": []
      }],
      "event_trigger_data": [{
        "filters": [],
        "not_filters": []
      }],
      "filters": [],
      "not_filters": []
    }`,
  },

  // warnings
  {
    name: 'unknown-field',
    input: `{
      "event_trigger_data": [{"value": 3}],
      "x": true
    }`,
    expectedWarnings: [
      {
        path: ['event_trigger_data', 0, 'value'],
        msg: 'unknown field',
      },
      {
        path: ['x'],
        msg: 'unknown field',
      },
    ],
  },

  // errors
  {
    name: 'invalid-json',
    input: ``,
    expectedErrors: [{ msg: 'SyntaxError: Unexpected end of JSON input' }],
    expected: Maybe.None,
  },
  {
    name: 'wrong-root-type',
    input: `1`,
    expectedErrors: [
      {
        path: [],
        msg: 'must be an object',
      },
    ],
    expected: Maybe.None,
  },

  {
    name: 'filters-wrong-type',
    input: `{"filters": 1}`,
    expectedErrors: [
      {
        path: ['filters'],
        msg: 'must be a list or an object',
      },
    ],
  },
  {
    name: 'filters-values-wrong-type',
    input: `{"filters": {"a": "b"}}`,
    expectedErrors: [
      {
        path: ['filters', 'a'],
        msg: 'must be a list',
      },
    ],
  },
  {
    name: 'filters-value-wrong-type',
    input: `{"filters": {"a": [1]}}`,
    expectedErrors: [
      {
        path: ['filters', 'a', 0],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'filters-lookback-window-wrong-type',
    input: `{"filters": {"_lookback_window": []}}`,
    expectedErrors: [
      {
        path: ['filters', '_lookback_window'],
        msg: 'must be a number',
      },
    ],
  },
  {
    name: 'filters-lookback-window-negative',
    input: `{"filters": {"_lookback_window": 0}}`,
    expectedErrors: [
      {
        path: ['filters', '_lookback_window'],
        msg: 'must be positive',
      },
    ],
  },
  {
    name: 'filters-reserved-key',
    input: `{"filters": {"_some_key": []}}`,
    expectedErrors: [
      {
        path: ['filters', '_some_key'],
        msg: 'is prohibited as keys starting with "_" are reserved',
      },
    ],
  },
  {
    name: 'filters-duplicate-value',
    input: `{"filters": {
      "a": ["x", "y", "x"],
      "b": ["y"]
    }}`,
    expectedWarnings: [
      {
        path: ['filters', 'a', 2],
        msg: 'duplicate value x',
      },
    ],
  },
  {
    name: 'filters-unknown-source-type',
    input: `{"filters": {"source_type": ["EVENT", "event", "navigation"]}}`,
    expectedWarnings: [
      {
        path: ['filters', 'source_type', 0],
        msg: 'unknown value EVENT (source_type can only match one of event, navigation)',
      },
    ],
  },

  {
    name: 'not-filters-wrong-type',
    input: `{"not_filters": 1}`,
    expectedErrors: [
      {
        path: ['not_filters'],
        msg: 'must be a list or an object',
      },
    ],
  },
  {
    name: 'not-filters-values-wrong-type',
    input: `{"not_filters": {"a": "b"}}`,
    expectedErrors: [
      {
        path: ['not_filters', 'a'],
        msg: 'must be a list',
      },
    ],
  },
  {
    name: 'not-filters-value-wrong-type',
    input: `{"not_filters": {"a": [1]}}`,
    expectedErrors: [
      {
        path: ['not_filters', 'a', 0],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'not-filters-reserved-key',
    input: `{"not_filters": {"_some_key": []}}`,
    expectedErrors: [
      {
        path: ['not_filters', '_some_key'],
        msg: 'is prohibited as keys starting with "_" are reserved',
      },
    ],
  },

  {
    name: 'aggregatable-values-wrong-type',
    input: `{"aggregatable_values": 1}`,
    expectedErrors: [
      {
        path: ['aggregatable_values'],
        msg: 'must be an object or a list',
      },
    ],
  },
  {
    name: 'aggregatable-values-value-wrong-type',
    input: `{"aggregatable_values": {"a": "1"}}`,
    expectedErrors: [
      {
        path: ['aggregatable_values', 'a'],
        msg: 'must be a number or an object',
      },
    ],
  },
  {
    name: 'aggregatable-values-value-below-min',
    input: `{"aggregatable_values": {"a": 0}}`,
    expectedErrors: [
      {
        path: ['aggregatable_values', 'a'],
        msg: 'must be in the range [1, 65536]',
      },
    ],
  },
  {
    name: 'aggregatable-values-value-above-max',
    input: `{"aggregatable_values": {"a": 65537}}`,
    expectedErrors: [
      {
        path: ['aggregatable_values', 'a'],
        msg: 'must be in the range [1, 65536]',
      },
    ],
  },
  {
    name: 'aggregatable-values-list-values-field-missing',
    input: `{
      "aggregatable_values": [
        {
          "a": 1
        }
      ]
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_values', 0, 'values'],
        msg: 'required',
      },
    ],
    expectedWarnings: [
      {
        msg: 'unknown field',
        path: ['aggregatable_values', 0, 'a'],
      },
    ],
  },
  {
    name: 'aggregatable-values-list-wrong-type',
    input: `{
      "aggregatable_values": [
        {
          "values": []
        }
      ]
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_values', 0, 'values'],
        msg: 'must be an object',
      },
    ],
  },

  {
    name: 'inconsistent-aggregatable-keys',
    input: `{
      "aggregatable_trigger_data": [
        {
          "key_piece": "0x1",
          "source_keys": ["a"]
        },
        {
          "key_piece": "0x2",
          "source_keys": ["b", "a"]
        }
      ],
      "aggregatable_values": {
        "b": 1,
        "c": 2
      }
    }`,
    expectedWarnings: [
      {
        path: ['aggregatable_trigger_data', 0, 'source_keys'],
        msg: 'key "a" will never result in a contribution due to absence from aggregatable_values',
      },
      {
        path: ['aggregatable_trigger_data', 1, 'source_keys'],
        msg: 'key "a" will never result in a contribution due to absence from aggregatable_values',
      },
      {
        path: ['aggregatable_values'],
        msg: `key "c"'s absence from aggregatable_trigger_data source_keys equivalent to presence with key_piece 0x0`,
      },
    ],
  },

  {
    name: 'debug-reporting-wrong-type',
    input: `{"debug_reporting": "true"}`,
    expectedErrors: [
      {
        path: ['debug_reporting'],
        msg: 'must be a boolean',
      },
    ],
  },

  {
    name: 'debug-key-wrong-type',
    input: `{"debug_key": 1}`,
    expectedErrors: [
      {
        path: ['debug_key'],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'debug-key-wrong-format',
    input: `{"debug_key": "-1"}`,
    expectedErrors: [
      {
        path: ['debug_key'],
        msg: 'string must represent a non-negative integer (must match /^[0-9]+$/)',
      },
    ],
  },

  {
    name: 'aggregatable-deduplication-keys-wrong-type',
    input: `{"aggregatable_deduplication_keys": 1}`,
    expectedErrors: [
      {
        path: ['aggregatable_deduplication_keys'],
        msg: 'must be a list',
      },
    ],
  },
  {
    name: 'aggregatable-deduplication-keys-value-wrong-type',
    input: `{"aggregatable_deduplication_keys": [1]}`,
    expectedErrors: [
      {
        path: ['aggregatable_deduplication_keys', 0],
        msg: 'must be an object',
      },
    ],
  },
  {
    name: 'aggregatable-deduplication-key-wrong-type',
    input: `{"aggregatable_deduplication_keys": [{
      "deduplication_key": 1
    }]}`,
    expectedErrors: [
      {
        path: ['aggregatable_deduplication_keys', 0, 'deduplication_key'],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'aggregatable-deduplication-key-wrong-format',
    input: `{"aggregatable_deduplication_keys": [{
      "deduplication_key": "-1"
    }]}`,
    expectedErrors: [
      {
        path: ['aggregatable_deduplication_keys', 0, 'deduplication_key'],
        msg: 'string must represent a non-negative integer (must match /^[0-9]+$/)',
      },
    ],
  },
  {
    name: 'aggregatable-deduplication-key-or-filters',
    input: `{"aggregatable_deduplication_keys": [{
      "filters": [],
      "not_filters": []
    }]}`,
  },

  {
    name: 'event-trigger-data-wrong-type',
    input: `{"event_trigger_data": 1}`,
    expectedErrors: [
      {
        path: ['event_trigger_data'],
        msg: 'must be a list',
      },
    ],
  },
  {
    name: 'event-trigger-data-value-wrong-type',
    input: `{"event_trigger_data": [1]}`,
    expectedErrors: [
      {
        path: ['event_trigger_data', 0],
        msg: 'must be an object',
      },
    ],
  },
  {
    name: 'event-trigger-data-filters-wrong-type',
    input: `{"event_trigger_data": [{"filters": 1}]}`,
    expectedErrors: [
      {
        path: ['event_trigger_data', 0, 'filters'],
        msg: 'must be a list or an object',
      },
    ],
  },
  {
    name: 'event-trigger-data-filters-values-wrong-type',
    input: `{"event_trigger_data": [{"filters": {"a": "b"}}]}`,
    expectedErrors: [
      {
        path: ['event_trigger_data', 0, 'filters', 'a'],
        msg: 'must be a list',
      },
    ],
  },
  {
    name: 'event-trigger-data-filters-value-wrong-type',
    input: `{"event_trigger_data": [{"filters": {"a": [1]}}]}`,
    expectedErrors: [
      {
        path: ['event_trigger_data', 0, 'filters', 'a', 0],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'event-trigger-data-filters-reserved-key',
    input: `{"event_trigger_data": [{
      "filters": {"_some_key": []}
    }]}`,
    expectedErrors: [
      {
        path: ['event_trigger_data', 0, 'filters', '_some_key'],
        msg: 'is prohibited as keys starting with "_" are reserved',
      },
    ],
  },

  {
    name: 'event-trigger-data-not-filters-wrong-type',
    input: `{"event_trigger_data": [{"not_filters": 1}]}`,
    expectedErrors: [
      {
        path: ['event_trigger_data', 0, 'not_filters'],
        msg: 'must be a list or an object',
      },
    ],
  },
  {
    name: 'event-trigger-data-not-filters-values-wrong-type',
    input: `{"event_trigger_data": [{"not_filters": {"a": "b"}}]}`,
    expectedErrors: [
      {
        path: ['event_trigger_data', 0, 'not_filters', 'a'],
        msg: 'must be a list',
      },
    ],
  },
  {
    name: 'event-trigger-data-not-filters-value-wrong-type',
    input: `{"event_trigger_data": [{"not_filters": {"a": [1]}}]}`,
    expectedErrors: [
      {
        path: ['event_trigger_data', 0, 'not_filters', 'a', 0],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'event-trigger-data-not-filters-reserved-key',
    input: `{"event_trigger_data": [{
      "not_filters": {"_some_key": []}
    }]}`,
    expectedErrors: [
      {
        path: ['event_trigger_data', 0, 'not_filters', '_some_key'],
        msg: 'is prohibited as keys starting with "_" are reserved',
      },
    ],
  },

  {
    name: 'aggregatable-trigger-data-wrong-type',
    input: `{"aggregatable_trigger_data": 1}`,
    expectedErrors: [
      {
        path: ['aggregatable_trigger_data'],
        msg: 'must be a list',
      },
    ],
  },
  {
    name: 'aggregatable-trigger-data-value-wrong-type',
    input: `{"aggregatable_trigger_data": [1]}`,
    expectedErrors: [
      {
        path: ['aggregatable_trigger_data', 0],
        msg: 'must be an object',
      },
    ],
  },

  {
    name: 'trigger-data-wrong-type',
    input: `{"event_trigger_data": [{
      "trigger_data": 1
    }]}`,
    expectedErrors: [
      {
        path: ['event_trigger_data', 0, 'trigger_data'],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'trigger-data-wrong-format',
    input: `{"event_trigger_data": [{
      "trigger_data": "-1"
    }]}`,
    expectedErrors: [
      {
        path: ['event_trigger_data', 0, 'trigger_data'],
        msg: 'string must represent a non-negative integer (must match /^[0-9]+$/)',
      },
    ],
  },

  {
    name: 'priority-wrong-type',
    input: `{"event_trigger_data": [{
      "priority": 1
    }]}`,
    expectedErrors: [
      {
        path: ['event_trigger_data', 0, 'priority'],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'priority-wrong-format',
    input: `{"event_trigger_data": [{
      "priority": "a"
    }]}`,
    expectedErrors: [
      {
        path: ['event_trigger_data', 0, 'priority'],
        msg: 'string must represent an integer (must match /^-?[0-9]+$/)',
      },
    ],
  },

  {
    name: 'deduplication-key-wrong-type',
    input: `{"event_trigger_data": [{
      "deduplication_key": 1
    }]}`,
    expectedErrors: [
      {
        path: ['event_trigger_data', 0, 'deduplication_key'],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'deduplication-key-wrong-format',
    input: `{"event_trigger_data": [{
      "deduplication_key": "-1"
    }]}`,
    expectedErrors: [
      {
        path: ['event_trigger_data', 0, 'deduplication_key'],
        msg: 'string must represent a non-negative integer (must match /^[0-9]+$/)',
      },
    ],
  },

  {
    name: 'source-keys-wrong-type',
    input: `{"aggregatable_trigger_data": [{
      "key_piece": "0x1",
      "source_keys": false
    }]}`,
    expectedErrors: [
      {
        path: ['aggregatable_trigger_data', 0, 'source_keys'],
        msg: 'must be a list',
      },
    ],
  },
  {
    name: 'source-keys-value-wrong-type',
    input: `{"aggregatable_trigger_data": [{
      "key_piece": "0x1",
      "source_keys": [false]
    }]}`,
    expectedErrors: [
      {
        path: ['aggregatable_trigger_data', 0, 'source_keys', 0],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'source-keys-duplicate-value',
    input: `{
      "aggregatable_trigger_data": [
        {
          "key_piece": "0x1",
          "source_keys": ["a", "x", "a"]
        },
        {
          "key_piece": "0x2",
          "source_keys": ["x"]
        }
      ],
      "aggregatable_values": {
        "a": 1,
        "x": 1
      }
    }`,
    expectedWarnings: [
      {
        path: ['aggregatable_trigger_data', 0, 'source_keys', 2],
        msg: 'duplicate value a',
      },
    ],
  },

  {
    name: 'key-piece-missing',
    input: `{"aggregatable_trigger_data": [{}]}`,
    expectedErrors: [
      {
        path: ['aggregatable_trigger_data', 0, 'key_piece'],
        msg: 'required',
      },
    ],
  },
  {
    name: 'key-piece-wrong-type',
    input: `{"aggregatable_trigger_data": [{
      "key_piece": 1
    }]}`,
    expectedErrors: [
      {
        path: ['aggregatable_trigger_data', 0, 'key_piece'],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'key-piece-wrong-format',
    input: `{"aggregatable_trigger_data": [{
      "key_piece": "f"
    }]}`,
    expectedErrors: [
      {
        path: ['aggregatable_trigger_data', 0, 'key_piece'],
        msg: 'must be a hex128 (must match /^0[xX][0-9A-Fa-f]{1,32}$/)',
      },
    ],
  },

  {
    name: 'aggregatable_trigger_data-filters-wrong-type',
    input: `{"aggregatable_trigger_data": [{
      "key_piece": "0x1",
      "filters": 1
    }]}`,
    expectedErrors: [
      {
        path: ['aggregatable_trigger_data', 0, 'filters'],
        msg: 'must be a list or an object',
      },
    ],
  },
  {
    name: 'aggregatable_trigger_data-filters-values-wrong-type',
    input: `{"aggregatable_trigger_data": [{
      "key_piece": "0x1",
      "filters": {"a": "b"}
    }]}`,
    expectedErrors: [
      {
        path: ['aggregatable_trigger_data', 0, 'filters', 'a'],
        msg: 'must be a list',
      },
    ],
  },
  {
    name: 'aggregatable_trigger_data-filters-value-wrong-type',
    input: `{"aggregatable_trigger_data": [{
      "key_piece": "0x1",
      "filters": {"a": [1]}
    }]}`,
    expectedErrors: [
      {
        path: ['aggregatable_trigger_data', 0, 'filters', 'a', 0],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'aggregatable_trigger_data-filters-reserved-key',
    input: `{"aggregatable_trigger_data": [{
      "key_piece": "0x1",
      "filters": {"_some_key": []}
    }]}`,
    expectedErrors: [
      {
        path: ['aggregatable_trigger_data', 0, 'filters', '_some_key'],
        msg: 'is prohibited as keys starting with "_" are reserved',
      },
    ],
  },

  {
    name: 'aggregatable_trigger_data-not-filters-wrong-type',
    input: `{"aggregatable_trigger_data": [{
      "key_piece": "0x1",
      "not_filters": 1
    }]}`,
    expectedErrors: [
      {
        path: ['aggregatable_trigger_data', 0, 'not_filters'],
        msg: 'must be a list or an object',
      },
    ],
  },
  {
    name: 'aggregatable_trigger_data-not-filters-values-wrong-type',
    input: `{"aggregatable_trigger_data": [{
      "key_piece": "0x1",
      "not_filters": {"a": "b"}
    }]}`,
    expectedErrors: [
      {
        path: ['aggregatable_trigger_data', 0, 'not_filters', 'a'],
        msg: 'must be a list',
      },
    ],
  },
  {
    name: 'aggregatable_trigger_data-not-filters-value-wrong-type',
    input: `{"aggregatable_trigger_data": [{
      "key_piece": "0x1",
      "not_filters": {"a": [1]}
    }]}`,
    expectedErrors: [
      {
        path: ['aggregatable_trigger_data', 0, 'not_filters', 'a', 0],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'aggregatable_trigger_data-not-filters-reserved-key',
    input: `{"aggregatable_trigger_data": [{
      "key_piece": "0x1",
      "not_filters": {"_some_key": []}
    }]}`,
    expectedErrors: [
      {
        path: ['aggregatable_trigger_data', 0, 'not_filters', '_some_key'],
        msg: 'is prohibited as keys starting with "_" are reserved',
      },
    ],
  },

  {
    name: 'aggregation-coordinator-origin-wrong-type',
    input: `{"aggregation_coordinator_origin": 1}`,
    expectedErrors: [
      {
        path: ['aggregation_coordinator_origin'],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'aggregation-coordinator-origin-not-url',
    input: `{"aggregation_coordinator_origin": "a.test"}`,
    expectedErrors: [
      {
        path: ['aggregation_coordinator_origin'],
        msg: 'invalid URL',
      },
    ],
  },
  {
    name: 'aggregation-coordinator-origin-untrustworthy',
    input: `{"aggregation_coordinator_origin": "http://a.test"}`,
    expectedErrors: [
      {
        path: ['aggregation_coordinator_origin'],
        msg: 'URL must use HTTP/HTTPS and be potentially trustworthy',
      },
    ],
  },
  {
    name: 'aggregation-coordinator-origin-path-ignored',
    input: `{"aggregation_coordinator_origin": "https://b.A.tEsT/x"}`,
    vsv: {
      aggregationCoordinatorOrigins: ['https://b.a.test'],
    },
    expectedWarnings: [
      {
        path: ['aggregation_coordinator_origin'],
        msg: 'URL components other than origin (https://b.a.test) will be ignored',
      },
    ],
  },
  {
    name: 'aggregation-coordinator-origin-not-on-allowlist',
    input: `{"aggregation_coordinator_origin": "https://c.a.test"}`,
    vsv: {
      aggregationCoordinatorOrigins: ['https://d.a.test', 'https://b.a.test'],
    },
    expectedErrors: [
      {
        path: ['aggregation_coordinator_origin'],
        msg: 'must be one of the following: https://d.a.test, https://b.a.test',
      },
    ],
  },

  {
    name: 'aggregatable-source-registration-time-wrong-type',
    input: `{"aggregatable_source_registration_time": 1}`,
    expectedErrors: [
      {
        path: ['aggregatable_source_registration_time'],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'aggregatable-source-registration-time-unknown-value',
    input: `{"aggregatable_source_registration_time": "EXCLUDE"}`,
    expectedErrors: [
      {
        path: ['aggregatable_source_registration_time'],
        msg: 'must be one of the following (case-sensitive): exclude, include',
      },
    ],
  },

  {
    name: 'trigger-context-id-wrong-type',
    input: `{"trigger_context_id": 1}`,
    expectedErrors: [
      {
        path: ['trigger_context_id'],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'trigger-context-id-too-long',
    input: `{"trigger_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}`,
    expectedErrors: [
      {
        path: ['trigger_context_id'],
        msg: 'exceeds max length per trigger context ID (65 > 64)',
      },
    ],
  },
  {
    name: 'trigger-context-id-invalid-aggregatable-source-registration-time',
    input: `{"trigger_context_id": "a", "aggregatable_source_registration_time": 1}`,
    expectedErrors: [
      {
        path: ['aggregatable_source_registration_time'],
        msg: 'must be a string',
      },
      {
        path: ['trigger_context_id'],
        msg: 'cannot be fully validated without a valid aggregatable_source_registration_time',
      },
    ],
  },
  {
    name: 'trigger-context-id-prohibited-aggregatable-source-registration-time-include',
    input: `{"aggregatable_source_registration_time": "include", "trigger_context_id": "123"}`,
    expectedErrors: [
      {
        path: ['trigger_context_id'],
        msg: 'is prohibited for aggregatable_source_registration_time include',
      },
    ],
  },
  {
    name: 'aggregatable_filtering_id_max_bytes-too-big',
    input: `{
      "aggregatable_filtering_id_max_bytes": 9
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_filtering_id_max_bytes'],
        msg: 'must be in the range [1, 8]',
      },
    ],
  },
  {
    name: 'aggregatable_filtering_id_max_bytes-invalid-aggregatable-source-registration-time',
    input: `{"aggregatable_filtering_id_max_bytes": 2, "aggregatable_source_registration_time": 1}`,
    expectedErrors: [
      {
        path: ['aggregatable_source_registration_time'],
        msg: 'must be a string',
      },
      {
        path: ['aggregatable_filtering_id_max_bytes'],
        msg: 'cannot be fully validated without a valid aggregatable_source_registration_time',
      },
    ],
  },
  {
    name: 'aggregatable_filtering_id_max_bytes-prohibited-aggregatable-source-registration-time-include',
    input: `{"aggregatable_filtering_id_max_bytes": 2, "aggregatable_source_registration_time": "include"}`,
    expectedErrors: [
      {
        path: ['aggregatable_filtering_id_max_bytes'],
        msg: 'with a non-default value (higher than 1) is prohibited for aggregatable_source_registration_time include',
      },
    ],
  },
  {
    name: 'aggregatable-values-with-too-big-filtering_id',
    input: `{
      "aggregatable_trigger_data": [{
        "key_piece": "0x1",
        "source_keys": ["x", "y"]
      }],
      "aggregatable_values": {"x": 5, "y": { "value": 10, "filtering_id": "256" }}
  }`,
    expectedErrors: [
      {
        path: ['aggregatable_values', 'y', 'filtering_id'],
        msg: 'must be in the range [0, 255]. It exceeds the default max size of 1 byte. To increase, specify the aggregatable_filtering_id_max_bytes property.',
      },
    ],
  },
  {
    name: 'aggregatable-values-with-too-big-filtering_id-non-default-max',
    input: `{
      "aggregatable_trigger_data": [{
        "key_piece": "0x1",
        "source_keys": ["x", "y"]
      }],
      "aggregatable_filtering_id_max_bytes": 2,
      "aggregatable_values": [
        {"values": {"x": 5 }},
        {"values": {"y": { "value": 10, "filtering_id": "65536" }}}
      ]
  }`,
    expectedErrors: [
      {
        path: ['aggregatable_values', 1, 'values', 'y', 'filtering_id'],
        msg: 'must be in the range [0, 65535]',
      },
    ],
  },
  {
    name: 'aggregatable-values-with-invalid-filtering_id-non-default-max',
    input: `{
      "aggregatable_trigger_data": [{
        "key_piece": "0x1",
        "source_keys": ["x", "y"]
      }],
      "aggregatable_filtering_id_max_bytes": "2",
      "aggregatable_values": [
        {"values": {"x": 5 }},
        {"values": {"y": { "value": 10, "filtering_id": "65536" }}}
      ]
  }`,
    expectedErrors: [
      {
        msg: 'must be a number',
        path: ['aggregatable_filtering_id_max_bytes'],
      },
      {
        path: ['aggregatable_values', 1, 'values', 'y', 'filtering_id'],
        msg: 'cannot be fully validated without a valid aggregatable_filtering_id_max_bytes',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-wrong-type',
    input: `{
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
    input: `{
      "aggregatable_debug_reporting": {}
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'key_piece'],
        msg: 'required',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-key-piece-wrong-type',
    input: `{
      "aggregatable_debug_reporting": {
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
    input: `{
      "aggregatable_debug_reporting": {
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
    input: `{
      "aggregatable_debug_reporting": {
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
    input: `{
      "aggregatable_debug_reporting": {
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
    input: `{
      "aggregatable_debug_reporting": {
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
    input: `{
      "aggregatable_debug_reporting": {
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
    input: `{
      "aggregatable_debug_reporting": {
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
    input: `{
      "aggregatable_debug_reporting": {
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
    input: `{
      "aggregatable_debug_reporting": {
        "key_piece": "0x1",
        "debug_data": [{
          "key_piece": 1,
          "types": ["trigger-unknown-error"],
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
    input: `{
      "aggregatable_debug_reporting": {
        "key_piece": "0x1",
        "debug_data": [{
          "key_piece": "1",
          "types": ["trigger-unknown-error"],
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
    input: `{
      "aggregatable_debug_reporting": {
        "key_piece": "0x1",
        "debug_data": [{
          "key_piece": "0x1",
          "types": ["trigger-unknown-error"],
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
    input: `{
      "aggregatable_debug_reporting": {
        "key_piece": "0x1",
        "debug_data": [{
          "key_piece": "0x1",
          "types": ["trigger-unknown-error"],
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
    input: `{
      "aggregatable_debug_reporting": {
        "key_piece": "0x1",
        "debug_data": [{
          "key_piece": "0x1",
          "types": ["trigger-unknown-error"],
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
    name: 'aggregatable-debug-reporting-data-elem-types-wrong-type',
    input: `{
      "aggregatable_debug_reporting": {
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
    input: `{
      "aggregatable_debug_reporting": {
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
    input: `{
      "aggregatable_debug_reporting": {
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
    input: `{
      "aggregatable_debug_reporting": {
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
    input: `{
      "aggregatable_debug_reporting": {
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
    input: `{
      "aggregatable_debug_reporting": {
        "key_piece": "0x1",
        "debug_data": [{
          "key_piece": "0x2",
          "types": ["trigger-unknown-error", "trigger-unknown-error"],
          "value": 123
        }]
      }
    }`,
    expectedErrors: [
      {
        path: ['aggregatable_debug_reporting', 'debug_data', 0, 'types', 1],
        msg: 'duplicate value trigger-unknown-error',
      },
    ],
  },
  {
    name: 'aggregatable-debug-reporting-data-elem-types-elem-duplicate-across',
    input: `{
      "aggregatable_debug_reporting": {
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

  // Attribution Scope
  {
    name: 'attribution-scope-not-string',
    input: `{"attribution_scopes": [1]}`,
    expectedErrors: [
      {
        path: ['attribution_scopes', 0],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'attribution-scopes-empty-list',
    input: `{
      "attribution_scopes": []
    }`,
  },
  {
    name: 'attribution-scopes-not-list',
    input: `{
      "attribution_scopes": 1
    }`,
    expectedErrors: [
      {
        path: ['attribution_scopes'],
        msg: 'must be a list',
      },
    ],
  },

  // Full Flex

  {
    name: 'value-wrong-type',
    input: `{"event_trigger_data": [{"value":"1"}]}`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['event_trigger_data', 0, 'value'],
        msg: 'must be a number',
      },
    ],
  },
  {
    name: 'value-zero',
    input: `{"event_trigger_data": [{"value":0}]}`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['event_trigger_data', 0, 'value'],
        msg: 'must be >= 1 and <= uint32 max (4294967295)',
      },
    ],
  },
  {
    name: 'value-negative',
    input: `{"event_trigger_data": [{"value":-1}]}`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['event_trigger_data', 0, 'value'],
        msg: 'must be >= 1 and <= uint32 max (4294967295)',
      },
    ],
  },
  {
    name: 'value-not-integer',
    input: `{"event_trigger_data": [{"value":1.5}]}`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['event_trigger_data', 0, 'value'],
        msg: 'must be an integer',
      },
    ],
  },
  {
    name: 'value-max',
    input: `{"event_trigger_data": [{"value":4294967295}]}`,
    parseFullFlex: true,
  },
  {
    name: 'value-gt-max',
    input: `{"event_trigger_data": [{"value":4294967296}]}`,
    parseFullFlex: true,
    expectedErrors: [
      {
        path: ['event_trigger_data', 0, 'value'],
        msg: 'must be >= 1 and <= uint32 max (4294967295)',
      },
    ],
  },

  // Named budgets.
  {
    name: 'named-budgets-wrong-type',
    input: `{"named_budgets": 1}`,
    parseNamedBudgets: true,
    expectedErrors: [
      {
        path: ['named_budgets'],
        msg: 'must be a list',
      },
    ],
  },
  {
    name: 'named-budgets-value-wrong-type',
    input: `{"named_budgets": [1]}`,
    parseNamedBudgets: true,
    expectedErrors: [
      {
        path: ['named_budgets', 0],
        msg: 'must be an object',
      },
    ],
  },
  {
    name: 'named-budget-wrong-type',
    input: `{"named_budgets": [{
      "name": 1
    }]}`,
    parseNamedBudgets: true,
    expectedErrors: [
      {
        path: ['named_budgets', 0, 'name'],
        msg: 'must be a string',
      },
    ],
  },
  {
    name: 'named_budget-missing-name',
    input: `{"named_budgets": [{
      "filters": [],
      "not_filters": []
    }]}`,
    parseNamedBudgets: true,
  },
]

testCases.forEach((tc) =>
  testutil.run(
    tc,
    trigger.validator({
      vsv: { ...vsv.Chromium, ...tc.vsv },
      fullFlex: tc.parseFullFlex,
      namedBudgets: tc.parseNamedBudgets,
    })
  )
)
