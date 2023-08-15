export const testCases = [
  // no errors or warnings
  {
    name: "required-fields-only",
    json: `{"destination": "https://a.test"}`,
  },
  {
    name: "multi-destination",
    json: `{"destination": ["https://a.test", "https://b.test"]}`,
  },
  {
    name: "all-fields",
    json: `{
      "aggregatable_report_window": "1",
      "aggregation_keys": {"a": "0xf"},
      "debug_key": "1",
      "debug_reporting": true,
      "destination": "https://a.test",
      "event_report_window": "2",
      "expiry": "3",
      "filter_data": {"b": ["c"]},
      "priority": "2",
      "source_event_id": "3",
      "max_event_level_reports": 2
    }`,
  },

  // warnings
  {
    name: "unknown-field",
    json: `{
      "destination": "https://a.test",
      "x": true
    }`,
    expectedWarnings: [{
      path: ["x"],
      msg: "unknown field",
    }],
  },
  {
    name: "destination-url-components",
    json: `{"destination": ["https://a.test/b?c=d#e", "https://x.y.test"]}`,
    expectedWarnings: [
      {
        path: ["destination", 0],
        msg: "URL components other than site (https://a.test) will be ignored",
      },
      {
        path: ["destination", 1],
        msg: "URL components other than site (https://y.test) will be ignored",
      },
    ],
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
    name: "wrong-root-type-null",
    json: `null`,
    expectedErrors: [{
      path: [],
      msg: "must be an object",
    }],
  },

  {
    name: "destination-missing",
    json: `{}`,
    expectedErrors: [{
      path: ["destination"],
      msg: "required",
    }],
  },
  {
    name: "destination-wrong-type",
    json: `{"destination": 1}`,
    expectedErrors: [{
      path: ["destination"],
      msg: "must be a list or a string",
    }],
  },
  {
    name: "destination-not-url",
    json: `{"destination": "a.test"}`,
    expectedErrors: [{
      path: ["destination"],
      msg: "invalid URL",
    }],
  },
  {
    name: "destination-untrustworthy",
    json: `{"destination": "http://a.test"}`,
    expectedErrors: [{
      path: ["destination"],
      msg: "URL must be potentially trustworthy",
    }],
  },

  {
    name: "filter-data-wrong-type",
    json: `{
      "destination": "https://a.test",
      "filter_data": 1
    }`,
    expectedErrors: [{
      path: ["filter_data"],
      msg: "must be an object",
    }],
  },
  {
    name: "filter-data-wrong-type-null",
    json: `{
      "destination": "https://a.test",
      "filter_data": null
    }`,
    expectedErrors: [{
      path: ["filter_data"],
      msg: "must be an object",
    }],
  },
  {
    name: "filter-data-values-wrong-type",
    json: `{
      "destination": "https://a.test",
      "filter_data": {"a": "b"}
    }`,
    expectedErrors: [{
      path: ["filter_data", "a"],
      msg: "must be a list",
    }],
  },
  {
    name: "filter-data-value-wrong-type",
    json: `{
      "destination": "https://a.test",
      "filter_data": {"a": [1]}
    }`,
    expectedErrors: [{
      path: ["filter_data", "a", 0],
      msg: "must be a string",
    }],
  },
  {
    name: "filter-data-source-type-key",
    json: `{
      "destination": "https://a.test",
      "filter_data": {"source_type": []}
    }`,
    expectedErrors: [{
      path: ["filter_data", "source_type"],
      msg: "is prohibited because it is implicitly set",
    }],
  },
  {
    name: "filter-data-lookback-window-key",
    json: `{
      "destination": "https://a.test",
      "filter_data": {"_lookback_window": []}
    }`,
    expectedErrors: [{
      path: ["filter_data", "_lookback_window"],
      msg: "is prohibited because it is implicitly set",
    }],
  },
  {
    name: "filter-data-duplicate-value",
    json: `{
      "destination": "https://a.test",
      "filter_data": {
        "a": ["x", "y", "x"],
        "b": ["y"]
      }
    }`,
    expectedWarnings: [{
      path: ["filter_data", "a", 2],
      msg: "duplicate value x",
    }],
  },
  // TODO: add tests for exceeding size limits

  {
    name: "aggregation-keys-wrong-type",
    json: `{
      "destination": "https://a.test",
      "aggregation_keys": 1
    }`,
    expectedErrors: [{
      path: ["aggregation_keys"],
      msg: "must be an object",
    }],
  },
  {
    name: "aggregation-keys-value-wrong-type",
    json: `{
      "destination": "https://a.test",
      "aggregation_keys": {"a": 1}
    }`,
    expectedErrors: [{
      path: ["aggregation_keys", "a"],
      msg: "must be a string",
    }],
  },
  {
    name: "aggregation-keys-value-wrong-format",
    json: `{
      "destination": "https://a.test",
      "aggregation_keys": {"a": "3"}
    }`,
    expectedErrors: [{
      path: ["aggregation_keys", "a"],
      msg: "must be a hex128 (must match /^0[xX][0-9A-Fa-f]{1,32}$/)",
    }],
  },
  // TODO: add tests for exceeding size limits

  {
    name: "source-event-id-wrong-type",
    json: `{
      "destination": "https://a.test",
      "source_event_id": 1
    }`,
    expectedErrors: [{
      path: ["source_event_id"],
      msg: "must be a string",
    }],
  },
  {
    name: "source-event-id-wrong-format",
    json: `{
      "destination": "https://a.test",
      "source_event_id": "-1"
    }`,
    expectedErrors: [{
      path: ["source_event_id"],
      msg: "must be a uint64 (must match /^[0-9]+$/)",
    }],
  },

  {
    name: "debug-key-wrong-type",
    json: `{
      "destination": "https://a.test",
      "debug_key": 1
    }`,
    expectedErrors: [{
      path: ["debug_key"],
      msg: "must be a string",
    }],
  },
  {
    name: "debug-key-wrong-format",
    json: `{
      "destination": "https://a.test",
      "debug_key": "-1"
    }`,
    expectedErrors: [{
      path: ["debug_key"],
      msg: "must be a uint64 (must match /^[0-9]+$/)",
    }],
  },

  {
    name: "priority-wrong-type",
    json: `{
      "destination": "https://a.test",
      "priority": 1
    }`,
    expectedErrors: [{
      path: ["priority"],
      msg: "must be a string",
    }],
  },
  {
    name: "priority-wrong-format",
    json: `{
      "destination": "https://a.test",
      "priority": "x"
    }`,
    expectedErrors: [{
      path: ["priority"],
      msg: "must be an int64 (must match /^-?[0-9]+$/)",
    }],
  },

  {
    name: "aggregatable-report-window-integer",
    json: `{
      "destination": "https://a.test",
      "aggregatable_report_window": 1
    }`,
  },
  {
    name: "aggregatable-report-window-wrong-type",
    json: `{
      "destination": "https://a.test",
      "aggregatable_report_window": false
    }`,
    expectedErrors: [{
      path: ["aggregatable_report_window"],
      msg: "must be a non-negative integer or a string",
    }],
  },
  {
    name: "aggregatable-report-window-wrong-format",
    json: `{
      "destination": "https://a.test",
      "aggregatable_report_window": "x"
    }`,
    expectedErrors: [{
      path: ["aggregatable_report_window"],
      msg: "must be a uint64 (must match /^[0-9]+$/)",
    }],
  },
  {
    name: "aggregatable-report-window-wrong-sign",
    json: `{
      "destination": "https://a.test",
      "aggregatable_report_window": "-1"
    }`,
    expectedErrors: [{
      path: ["aggregatable_report_window"],
      msg: "must be a uint64 (must match /^[0-9]+$/)",
    }],
  },
  {
    name: "aggregatable-report-window-integer-wrong-sign",
    json: `{
      "destination": "https://a.test",
      "aggregatable_report_window": -1
    }`,
    expectedErrors: [{
      path: ["aggregatable_report_window"],
      msg: "must be a non-negative integer",
    }],
  },

  {
    name: "event-report-window-integer",
    json: `{
      "destination": "https://a.test",
      "event_report_window": 1
    }`,
  },
  {
    name: "event-report-window-wrong-type",
    json: `{
      "destination": "https://a.test",
      "event_report_window": false
    }`,
    expectedErrors: [{
      path: ["event_report_window"],
      msg: "must be a non-negative integer or a string",
    }],
  },
  {
    name: "event-report-window-wrong-format",
    json: `{
      "destination": "https://a.test",
      "event_report_window": "x"
    }`,
    expectedErrors: [{
      path: ["event_report_window"],
      msg: "must be a uint64 (must match /^[0-9]+$/)",
    }],
  },
  {
    name: "event-report-window-wrong-sign",
    json: `{
      "destination": "https://a.test",
      "event_report_window": "-1"
    }`,
    expectedErrors: [{
      path: ["event_report_window"],
      msg: "must be a uint64 (must match /^[0-9]+$/)",
    }],
  },
  {
    name: "event-report-window-integer-wrong-sign",
    json: `{
      "destination": "https://a.test",
      "event_report_window": -1
    }`,
    expectedErrors: [{
      path: ["event_report_window"],
      msg: "must be a non-negative integer",
    }],
  },
  {
    name: "expiry-integer",
    json: `{
      "destination": "https://a.test",
      "expiry": 1
    }`,
  },
  {
    name: "expiry-wrong-type",
    json: `{
      "destination": "https://a.test",
      "expiry": false
    }`,
    expectedErrors: [{
      path: ["expiry"],
      msg: "must be a non-negative integer or a string",
    }],
  },
  {
    name: "expiry-wrong-format",
    json: `{
      "destination": "https://a.test",
      "expiry": "x"
    }`,
    expectedErrors: [{
      path: ["expiry"],
      msg: "must be a uint64 (must match /^[0-9]+$/)",
    }],
  },
  {
    name: "expiry-wrong-sign",
    json: `{
      "destination": "https://a.test",
      "expiry": "-1"
    }`,
    expectedErrors: [{
      path: ["expiry"],
      msg: "must be a uint64 (must match /^[0-9]+$/)",
    }],
  },
  {
    name: "expiry-integer-wrong-sign",
    json: `{
      "destination": "https://a.test",
      "expiry": -1
    }`,
    expectedErrors: [{
      path: ["expiry"],
      msg: "must be a non-negative integer",
    }],
  },

  {
    name: "debug-reporting-wrong-type",
    json: `{
      "destination": "https://a.test",
      "debug_reporting": "true"
    }`,
    expectedErrors: [{
      path: ["debug_reporting"],
      msg: "must be a boolean",
    }],
  },

  {
    name: "max-event-level-reports-wrong-type",
    json: `{
      "destination": "https://a.test",
      "max_event_level_reports": "2"
    }`,
    expectedErrors: [{
      path: ["max_event_level_reports"],
      msg: "must be an integer in the range [0, 20]",
    }],
  },
  {
    name: "max-event-level-reports-exceed-max",
    json: `{
      "destination": "https://a.test",
      "max_event_level_reports": 21
    }`,
    expectedErrors: [{
      path: ["max_event_level_reports"],
      msg: "must be an integer in the range [0, 20]",
    }],
  },
  {
    name: "event-level-report-windows-and-window",
    json: `{
      "destination": "https://a.test",
      "event_report_window": "21",
      "event_report_windows": {
        "end_times": [1000]
      }
    }`,
    expectedErrors: [{
      path: [],
      msg: "event_report_window and event_report_windows in the same source",
    }],
  },
  {
    name: "event-level-report-windows-no-end-times",
    json: `{
      "destination": "https://a.test",
      "event_report_windows": {
      }
    }`,
    expectedErrors: [{
      path: ['event_report_windows', 'end_times'],
      msg: "required",
    }],
  },
  {
    name: "event-level-report-windows-empty-end-times",
    json: `{
      "destination": "https://a.test",
      "event_report_windows": {
        "end_times": []
      }
    }`,
    expectedErrors: [{
      path: ['event_report_windows', 'end_times'],
      msg: "length must be in the range [1, 5]",
    }],
  },
  {
    name: "event-level-report-windows-excessive-end-times",
    json: `{
      "destination": "https://a.test",
      "event_report_windows": {
        "end_times": [1,2,3,4,5,6]
      }
    }`,
    expectedErrors: [{
      path: ['event_report_windows', 'end_times'],
      msg: "length must be in the range [1, 5]",
    }],
  },
  {
    name: "event-level-report-windows-start-time",
    json: `{
      "destination": "https://a.test",
      "event_report_windows": {
        "start_time": 10,
        "end_times": [11,12,13,14]
      }
    }`
  },
]
