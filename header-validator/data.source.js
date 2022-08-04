export const validSourceHeadersAsObjects = [
  {
    source_event_id: '12340873456',
    destination: 'https://example.com',
  },
  {
    source_event_id: '12340873456',
    destination: 'https://example.com',
    priority: '4567898765678',
    debug_key: '9876786543456',
    expiry: '123',
    aggregation_keys: {
      campaignCounts: '0x159',
      geoValue: '0x5',
    },
  },
]

export const validSourceHeadersAsJSON = validSourceHeadersAsObjects.map(
  JSON.stringify
)

export const invalidSourceHeadersAsObjects = [
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
    priority: 'bar',
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
  // Too many filters
  {
    source_event_id: '0',
    destination: 'https://example.com',
    filter_data: (function () {
      const obj = {}
      for (let i = 0; i < 51; i++) {
        obj[`${i}`] = []
      }
      return obj
    })(),
  },
  // Too many filter values
  {
    source_event_id: '0',
    destination: 'https://example.com',
    filter_data: {
      x: (function () {
        const arr = []
        for (let i = 0; i < 51; i++) {
          arr.push(`${i}`)
        }
        return arr
      })(),
    },
  },
  // Too many aggregation keys
  {
    source_event_id: '0',
    destination: 'https://example.com',
    aggregation_keys: (function () {
      const obj = {}
      for (let i = 0; i < 51; i++) {
        obj[`${i}`] = '0x1'
      }
      return obj
    })(),
  },
]

export const invalidSourceHeadersAsJSON = [
  // same invalid headers as above, but as JSON
  ...invalidSourceHeadersAsObjects.map(JSON.stringify),
  // additionally, one invalid JSON example: missing value
  '{"source_event_id":"12340873456","destination"}',
]
