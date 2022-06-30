import { validateSource } from './validate-json.js';
import { logHeaderListValidation } from './logger.js';

const validSourceHeaders = [
  {
    source_event_id: '12340873456',
    destination: 'https://example.com',
  },
  {
    source_event_id: '12340873456',
    destination: 'https://example.com',
    priority: '4567898765678',
    debug_key: '9876786543456',
    aggregation_keys: {
      campaignCounts: '0x159',
      geoValue: '0x5',
    },
  },
];

const invalidSourceHeaders = [
  // ❌ ❌ ❌  ERRORS ❌ ❌ ❌
  // Source ID not a string
  {
    source_event_id: 12340873456,
    destination: 'https://example.com',
  },
  // Source ID not a ui64
  {
    source_event_id: 'hello',
    destination: 'https://example.com',
  },
  // Source ID too big
  {
    source_event_id: '12340873456123408734561234087345612340873456',
    destination: 'https://example.com',
  },
  // Source ID is signed
  {
    source_event_id: '-12340873456',
    destination: 'https://example.com',
  },
  // Priority not a ui64
  {
    source_event_id: '12340873456',
    destination: 'https://example.com',
    priority: 'hello',
  },
  // Priority too big
  {
    source_event_id: '12340873456',
    destination: 'https://example.com',
    priority: '12340873456123408734561234087345612340873456',
  },
  // Priority is signed
  {
    source_event_id: '12340873456',
    destination: 'https://example.com',
    priority: '-12340873456',
  },
  // Debug key not a ui64
  {
    source_event_id: '12340873456',
    destination: 'https://example.com',
    debug_key: 'hello',
  },
  // Debug key too big
  {
    source_event_id: '12340873456',
    destination: 'https://example.com',
    debug_key: '12340873456123408734561234087345612340873456',
  },
  // Debug key is signed
  {
    source_event_id: '12340873456',
    destination: 'https://example.com',
    debug_key: '-12340873456',
  },
  // Destination not a valid URL
  {
    source_event_id: '12340873456',
    destination: 'not-a-url',
  },
  // Destination not trustworthy
  {
    source_event_id: '12340873456',
    destination: 'http://example.com',
  },
  // Missing required field Source event ID
  {
    destination: 'https://example.com',
  },
  // Missing required field Destination
  {
    source_event_id: '12340873456',
  },
  // One aggregation key not a hex string
  {
    source_event_id: '12340873456',
    destination: 'https://example.com',
    aggregation_keys: {
      campaignCounts: '1xabc',
    },
  },
  // One aggregation key not a hex string
  {
    source_event_id: '12340873456',
    destination: 'https://example.com',
    aggregation_keys: {
      campaignCounts: 0x159,
    },
  },
  // Multiple aggregation keys are not a hex string
  {
    source_event_id: '12340873456',
    destination: 'https://example.com',
    aggregation_keys: {
      campaignCounts: '1xabc',
      geoValue: 0x159,
      productCategory: '42',
    },
  },
  // Aggregation keys not an object
  {
    source_event_id: '12340873456',
    destination: 'https://example.com',
    aggregation_keys: ['1xabc'],
  },
  // Filter data not a list
  {
    source_event_id: '12340873456',
    destination: 'https://example.com',
    filter_data: {
      conversion_subdomain: 123,
    },
  },
  // Filter data not a list of strings
  {
    source_event_id: '12340873456',
    destination: 'https://example.com',
    filter_data: {
      conversion_subdomain: [123],
    },
  },
  // Filter data contains forbidden value
  {
    source_event_id: '12340873456',
    destination: 'https://example.com',
    filter_data: {
      conversion_subdomain: ['electronics.megastore', 'electronics2.megastore'],
      source_type: ['1234'],
    },
  },

  // Multiple errors
  {
    destination: 'foo',
    priority: '-12340873456',
  },
  // ⚠️ ⚠️ ⚠️ WARNINGS ⚠️ ⚠️ ⚠️
  // Unknown field `foo`
  {
    source_event_id: '12340873456',
    destination: 'https://example.com',
    foo: 'xxxxx',
  },
  // Destination contains a path that will be ignored
  {
    source_event_id: '12340873456',
    destination: 'https://example.com/foo',
  },
  // Destination contains a query string that will be ignored
  {
    source_event_id: '12340873456',
    destination: 'https://example.com?foo',
  },
  // Destination contains a fragment that will be ignored
  {
    source_event_id: '12340873456',
    destination: 'https://example.com#foo',
  },
];

// Test source headers validation
logHeaderListValidation(validSourceHeaders, validateSource);
logHeaderListValidation(invalidSourceHeaders, validateSource);

// OK DONE aggregation_keys: optional(aggregationKeys),
// OK DONE debug_key: optional(uint64),
// OK DONE destination: required(destination),
// OK DONE filter_data: optional(filters(/*allowSourceType=*/ false)),
// OK DONE priority: optional(int64),
// OK DONE source_event_id: required(uint64),

// const hex128Regex = /^0[xX][0-9A-Fa-f]{1,32}$/;

// "aggregation_keys": {
//   // Generates a "0x159" key piece (low order bits of the key) for the key named
//   // "campaignCounts".
//   "campaignCounts": "0x159", // User saw ad from campaign 345 (out of 511)

//   // Generates a "0x5" key piece (low order bits of the key) for the key named "geoValue".
//   "geoValue": "0x5" // Source-side geo region = 5 (US), out of a possible ~100 regions
// }

// filters is not a list
// filters is a list but not of strings
// filters contains source_type
// TODO multiple filter errors

// filter_data: { conversion_subdomain: [ 123 ] }
// }
// ----------------------------------------------
// ❌ 1 ERROR(S):
// must be a string: ["filter_data"]["conversion_subdomain"][0]
