export const testCases = [
  // no errors or warnings
  {
    name: "required-fields-only",
    json: `{}`,
  },
  {
    name: "all-fields",
    json: `{
      "aggregatable_deduplication_keys": [{
        "deduplication_key": "123",
        "filters": {"x": []},
        "not_filters": {"y": []}
      }],
      "aggregatable_source_registration_time": "include",
      "aggregatable_trigger_data": [{
        "filters": {"a": ["b"]},
        "key_piece": "0x1",
        "not_filters": {"c": ["d"]},
        "source_keys": ["x"]
      }],
      "aggregatable_values": {"e": 5},
      "debug_key": "5",
      "debug_reporting": true,
      "event_trigger_data": [{
        "deduplication_key": "123",
        "filters": {"x": []},
        "not_filters": {"y": []},
        "priority": "-7",
        "trigger_data": "6"
      }],
      "filters": {"f": []},
      "not_filters": {"g": []}
    }`,
  },
  {
    name: "or-filters",
    json: `{
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
    name: "empty-or-filters",
    json: `{
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
    name: "unknown-field",
    json: `{"x": true}`,
    expectedWarnings: [{
      path: ["x"],
      msg: "unknown field",
    }],
  },

  // errors
  {
    name: "invalid-json",
    json: ``,
    expectedErrors: [{msg: "SyntaxError: Unexpected end of JSON input"}],
  },
  {
    name: "wrong-root-type",
    json: `1`,
    expectedErrors: [{
      path: [],
      msg: "must be an object",
    }],
  },

  {
    name: "filters-wrong-type",
    json: `{"filters": 1}`,
    expectedErrors: [{
      path: ["filters"],
      msg: "must be a list or an object",
    }],
  },
  {
    name: "filters-values-wrong-type",
    json: `{"filters": {"a": "b"}}`,
    expectedErrors: [{
      path: ["filters", "a"],
      msg: "must be a list",
    }],
  },
  {
    name: "filters-value-wrong-type",
    json: `{"filters": {"a": [1]}}`,
    expectedErrors: [{
      path: ["filters", "a", 0],
      msg: "must be a string",
    }],
  },
  {
    name: "filters-lookback-window-wrong-type",
    json: `{"filters": {"_lookback_window": []}}`,
    expectedErrors: [{
      path: ["filters", "_lookback_window"],
      msg: "must be a number",
    }],
  },
  {
    name: "filters-lookback-window-negative",
    json: `{"filters": {"_lookback_window": 0}}`,
    expectedErrors: [{
      path: ["filters", "_lookback_window"],
      msg: "must be a positive integer",
    }],
  },

  {
    name: "not-filters-wrong-type",
    json: `{"not_filters": 1}`,
    expectedErrors: [{
      path: ["not_filters"],
      msg: "must be a list or an object",
    }],
  },
  {
    name: "not-filters-values-wrong-type",
    json: `{"not_filters": {"a": "b"}}`,
    expectedErrors: [{
      path: ["not_filters", "a"],
      msg: "must be a list",
    }],
  },
  {
    name: "not-filters-value-wrong-type",
    json: `{"not_filters": {"a": [1]}}`,
    expectedErrors: [{
      path: ["not_filters", "a", 0],
      msg: "must be a string",
    }],
  },

  {
    name: "aggregatable-values-wrong-type",
    json: `{"aggregatable_values": 1}`,
    expectedErrors: [{
      path: ["aggregatable_values"],
      msg: "must be an object",
    }],
  },
  {
    name: "aggregatable-values-value-wrong-type",
    json: `{"aggregatable_values": {"a": "1"}}`,
    expectedErrors: [{
      path: ["aggregatable_values", "a"],
      msg: "must be an integer in the range (1, 65536]",
    }],
  },
  {
    name: "aggregatable-values-value-below-min",
    json: `{"aggregatable_values": {"a": 0}}`,
    expectedErrors: [{
      path: ["aggregatable_values", "a"],
      msg: "must be an integer in the range (1, 65536]",
    }],
  },
  {
    name: "aggregatable-values-value-above-max",
    json: `{"aggregatable_values": {"a": 65537}}`,
    expectedErrors: [{
      path: ["aggregatable_values", "a"],
      msg: "must be an integer in the range (1, 65536]",
    }],
  },
  // TODO: add tests for exceeding size limits

  {
    name: "debug-reporting-wrong-type",
    json: `{"debug_reporting": "true"}`,
    expectedErrors: [{
      path: ["debug_reporting"],
      msg: "must be a boolean",
    }],
  },

  {
    name: "debug-key-wrong-type",
    json: `{"debug_key": 1}`,
    expectedErrors: [{
      path: ["debug_key"],
      msg: "must be a string",
    }],
  },
  {
    name: "debug-key-wrong-format",
    json: `{"debug_key": "-1"}`,
    expectedErrors: [{
      path: ["debug_key"],
      msg: "must be a uint64 (must match /^[0-9]+$/)",
    }],
  },

  {
    name: "aggregatable-deduplication-keys-wrong-type",
    json: `{"aggregatable_deduplication_keys": 1}`,
    expectedErrors: [{
      path: ["aggregatable_deduplication_keys"],
      msg: "must be a list",
    }],
  },
  {
    name: "aggregatable-deduplication-keys-value-wrong-type",
    json: `{"aggregatable_deduplication_keys": [1]}`,
    expectedErrors: [{
      path: ["aggregatable_deduplication_keys", 0],
      msg: "must be an object",
    }],
  },
  {
    name: "aggregatable-deduplication-key-wrong-type",
    json: `{"aggregatable_deduplication_keys": [{
      "deduplication_key": 1
    }]}`,
    expectedErrors: [{
      path: ["aggregatable_deduplication_keys", 0, "deduplication_key"],
      msg: "must be a string",
    }],
  },
  {
    name: "aggregatable-deduplication-key-wrong-format",
    json: `{"aggregatable_deduplication_keys": [{
      "deduplication_key": "-1"
    }]}`,
    expectedErrors: [{
      path: ["aggregatable_deduplication_keys", 0, "deduplication_key"],
      msg: "must be a uint64 (must match /^[0-9]+$/)",
    }],
  },

  {
    name: "event-trigger-data-wrong-type",
    json: `{"event_trigger_data": 1}`,
    expectedErrors: [{
      path: ["event_trigger_data"],
      msg: "must be a list",
    }],
  },
  {
    name: "event-trigger-data-value-wrong-type",
    json: `{"event_trigger_data": [1]}`,
    expectedErrors: [{
      path: ["event_trigger_data", 0],
      msg: "must be an object",
    }],
  },
  {
    name: "event-trigger-data-filters-wrong-type",
    json: `{"event_trigger_data": [{"filters": 1}]}`,
    expectedErrors: [{
      path: ["event_trigger_data", 0, "filters"],
      msg: "must be a list or an object",
    }],
  },
  {
    name: "event-trigger-data-filters-values-wrong-type",
    json: `{"event_trigger_data": [{"filters": {"a": "b"}}]}`,
    expectedErrors: [{
      path: ["event_trigger_data", 0 ,"filters", "a"],
      msg: "must be a list",
    }],
  },
  {
    name: "event-trigger-data-filters-value-wrong-type",
    json: `{"event_trigger_data": [{"filters": {"a": [1]}}]}`,
    expectedErrors: [{
      path: ["event_trigger_data", 0, "filters", "a", 0],
      msg: "must be a string",
    }],
  },

  {
    name: "event-trigger-data-not-filters-wrong-type",
    json: `{"event_trigger_data": [{"not_filters": 1}]}`,
    expectedErrors: [{
      path: ["event_trigger_data", 0, "not_filters"],
      msg: "must be a list or an object",
    }],
  },
  {
    name: "event-trigger-data-not-filters-values-wrong-type",
    json: `{"event_trigger_data": [{"not_filters": {"a": "b"}}]}`,
    expectedErrors: [{
      path: ["event_trigger_data", 0, "not_filters", "a"],
      msg: "must be a list",
    }],
  },
  {
    name: "event-trigger-data-not-filters-value-wrong-type",
    json: `{"event_trigger_data": [{"not_filters": {"a": [1]}}]}`,
    expectedErrors: [{
      path: ["event_trigger_data", 0, "not_filters", "a", 0],
      msg: "must be a string",
    }],
  },

  {
    name: "aggregatable-trigger-data-wrong-type",
    json: `{"aggregatable_trigger_data": 1}`,
    expectedErrors: [{
      path: ["aggregatable_trigger_data"],
      msg: "must be a list",
    }],
  },
  {
    name: "aggregatable-trigger-data-value-wrong-type",
    json: `{"aggregatable_trigger_data": [1]}`,
    expectedErrors: [{
      path: ["aggregatable_trigger_data", 0],
      msg: "must be an object",
    }],
  },

  {
    name: "trigger-data-wrong-type",
    json: `{"event_trigger_data": [{
      "trigger_data": 1
    }]}`,
    expectedErrors: [{
      path: ["event_trigger_data", 0, "trigger_data"],
      msg: "must be a string",
    }],
  },
  {
    name: "trigger-data-wrong-format",
    json: `{"event_trigger_data": [{
      "trigger_data": "-1"
    }]}`,
    expectedErrors: [{
      path: ["event_trigger_data", 0, "trigger_data"],
      msg: "must be a uint64 (must match /^[0-9]+$/)",
    }],
  },

  {
    name: "priority-wrong-type",
    json: `{"event_trigger_data": [{
      "priority": 1
    }]}`,
    expectedErrors: [{
      path: ["event_trigger_data", 0, "priority"],
      msg: "must be a string",
    }],
  },
  {
    name: "priority-wrong-format",
    json: `{"event_trigger_data": [{
      "priority": "a"
    }]}`,
    expectedErrors: [{
      path: ["event_trigger_data", 0, "priority"],
      msg: "must be an int64 (must match /^-?[0-9]+$/)",
    }],
  },

  {
    name: "deduplication-key-wrong-type",
    json: `{"event_trigger_data": [{
      "deduplication_key": 1
    }]}`,
    expectedErrors: [{
      path: ["event_trigger_data", 0, "deduplication_key"],
      msg: "must be a string",
    }],
  },
  {
    name: "deduplication-key-wrong-format",
    json: `{"event_trigger_data": [{
      "deduplication_key": "-1"
    }]}`,
    expectedErrors: [{
      path: ["event_trigger_data", 0, "deduplication_key"],
      msg: "must be a uint64 (must match /^[0-9]+$/)",
    }],
  },

  {
    name: "source-keys-wrong-type",
    json: `{"aggregatable_trigger_data": [{
      "key_piece": "0x1",
      "source_keys": false
    }]}`,
    expectedErrors: [{
      path: ["aggregatable_trigger_data", 0, "source_keys"],
      msg: "must be a list",
    }],
  },
  {
    name: "source-keys-value-wrong-type",
    json: `{"aggregatable_trigger_data": [{
      "key_piece": "0x1",
      "source_keys": [false]
    }]}`,
    expectedErrors: [{
      path: ["aggregatable_trigger_data", 0, "source_keys", 0],
      msg: "must be a string",
    }],
  },

  {
    name: "key-piece-missing",
    json: `{"aggregatable_trigger_data": [{"source_keys": []}]}`,
    expectedErrors: [{
      path: ["aggregatable_trigger_data", 0, "key_piece"],
      msg: "missing required field",
    }],
  },
  {
    name: "key-piece-wrong-type",
    json: `{"aggregatable_trigger_data": [{
      "key_piece": 1,
      "source_keys": []
    }]}`,
    expectedErrors: [{
      path: ["aggregatable_trigger_data", 0, "key_piece"],
      msg: "must be a string",
    }],
  },
  {
    name: "key-piece-wrong-format",
    json: `{"aggregatable_trigger_data": [{
      "key_piece": "f",
      "source_keys": []
    }]}`,
    expectedErrors: [{
      path: ["aggregatable_trigger_data", 0, "key_piece"],
      msg: "must be a hex128 (must match /^0[xX][0-9A-Fa-f]{1,32}$/)",
    }],
  },

  {
    name: "aggregatable_trigger_data-filters-wrong-type",
    json: `{"aggregatable_trigger_data": [{
      "key_piece": "0x1",
      "source_keys": ["x"],
      "filters": 1
    }]}`,
    expectedErrors: [{
      path: ["aggregatable_trigger_data", 0, "filters"],
      msg: "must be a list or an object",
    }],
  },
  {
    name: "aggregatable_trigger_data-filters-values-wrong-type",
    json: `{"aggregatable_trigger_data": [{
      "key_piece": "0x1",
      "source_keys": ["x"],
      "filters": {"a": "b"}
    }]}`,
    expectedErrors: [{
      path: ["aggregatable_trigger_data", 0 ,"filters", "a"],
      msg: "must be a list",
    }],
  },
  {
    name: "aggregatable_trigger_data-filters-value-wrong-type",
    json: `{"aggregatable_trigger_data": [{
      "key_piece": "0x1",
      "source_keys": ["x"],
      "filters": {"a": [1]}
    }]}`,
    expectedErrors: [{
      path: ["aggregatable_trigger_data", 0, "filters", "a", 0],
      msg: "must be a string",
    }],
  },

  {
    name: "aggregatable_trigger_data-not-filters-wrong-type",
    json: `{"aggregatable_trigger_data": [{
      "key_piece": "0x1",
      "source_keys": ["x"],
      "not_filters": 1
    }]}`,
    expectedErrors: [{
      path: ["aggregatable_trigger_data", 0, "not_filters"],
      msg: "must be a list or an object",
    }],
  },
  {
    name: "aggregatable_trigger_data-not-filters-values-wrong-type",
    json: `{"aggregatable_trigger_data": [{
      "key_piece": "0x1",
      "source_keys": ["x"],
      "not_filters": {"a": "b"}
    }]}`,
    expectedErrors: [{
      path: ["aggregatable_trigger_data", 0, "not_filters", "a"],
      msg: "must be a list",
    }],
  },
  {
    name: "aggregatable_trigger_data-not-filters-value-wrong-type",
    json: `{"aggregatable_trigger_data": [{
      "key_piece": "0x1",
      "source_keys": ["x"],
      "not_filters": {"a": [1]}
    }]}`,
    expectedErrors: [{
      path: ["aggregatable_trigger_data", 0, "not_filters", "a", 0],
      msg: "must be a string",
    }],
  },

  {
    name: "aggregation-coordinator-origin-wrong-type",
    json: `{"aggregation_coordinator_origin": 1}`,
    expectedErrors: [{
      path: ["aggregation_coordinator_origin"],
      msg: "must be a string",
    }],
  },
  {
    name: "aggregation-coordinator-origin-not-url",
    json: `{"aggregation_coordinator_origin": "a.test"}`,
    expectedErrors: [{
      path: ["aggregation_coordinator_origin"],
      msg: "must contain a valid URL",
    }],
  },
  {
    name: "aggregation-coordinator-origin-untrustworthy",
    json: `{"aggregation_coordinator_origin": "http://a.test"}`,
    expectedErrors: [{
      path: ["aggregation_coordinator_origin"],
      msg: "must contain a potentially trustworthy URL",
    }],
  },

  {
    name: "aggregatable-source-registration-time-wrong-type",
    json: `{"aggregatable_source_registration_time": 1}`,
    expectedErrors: [{
      path: ["aggregatable_source_registration_time"],
      msg: "must be a string",
    }],
  },
  {
    name: "aggregatable-source-registration-time-unknown-value",
    json: `{"aggregatable_source_registration_time": "EXCLUDE"}`,
    expectedErrors: [{
      path: ["aggregatable_source_registration_time"],
      msg: "must match 'exclude' or 'include' (case-sensitive)",
    }],
  },
];
