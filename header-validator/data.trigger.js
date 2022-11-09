export const validTriggerHeadersAsObjects = [
  {
    event_trigger_data: [
      {
        trigger_data: '99',
      },
    ],
  },
  {
    aggregatable_trigger_data: [
      {
        key_piece: '0x400',
        source_keys: ['campaignCounts'],
      },
      {
        key_piece: '0xA80',
        source_keys: ['geoValue'],
      },
    ],
    aggregatable_values: {
      campaignCounts: 232,
      geoValue: 1664,
    },
    debug_key: '98767654567654',
    debug_reporting: true,
    event_trigger_data: [
      {
        deduplication_key: '234567545678',
        filters: {
          conversion_subdomain: ['electronics.megastore'],
          directory: ['/store/electronics'],
        },
        priority: '456789876789',
        trigger_data: '3',
      },
    ],
    filters: {
      conversion_subdomain: ['electronics.megastore'],
      directory: ['/store/electronics'],
    },
    not_filters: {
      conversion_subdomain: ['foo.megastore'],
    },
    aggregatable_deduplication_key: '345678656789',
  },
]

export const validTriggerHeadersAsJSON = validTriggerHeadersAsObjects.map(
  JSON.stringify
)

export const invalidTriggerHeadersAsObjects = [
  // ❌ ERRORS
  // Event trigger data not a string
  {
    event_trigger_data: 3,
  },
  // Event trigger data wrong
  // TODO this one crashes the validator for now
  // {
  //   event_trigger_data: ['2343'],
  // },
  // Aggregatable values over budget
  {
    aggregatable_trigger_data: [
      {
        key_piece: '0x400',
        source_keys: ['campaignCounts'],
      },
    ],
    aggregatable_values: {
      campaignCounts: 12345334,
    },
  },
  // Aggregatable values are set but not keys
  {
    aggregatable_values: {
      campaignCounts: 123,
    },
  },
  // Aggregatable keys are set but not values
  {
    aggregatable_trigger_data: [
      {
        key_piece: '0x400',
        source_keys: ['campaignCounts'],
      },
    ],
  },
  // Key names don't all match
  {
    aggregatable_trigger_data: [
      {
        key_piece: '0x400',
        source_keys: ['campaignCounts'],
      },
    ],
    aggregatable_values: {
      xxcampaignCounts: 123,
    },
  },
  // ⚠️ ⚠️ ⚠️ WARNINGS ⚠️ ⚠️ ⚠️
  // Unknown field `foo`
  {
    foo: '3',
  },
  // Too many event trigger data
  {
    event_trigger_data: (function () {
      const arr = []
      for (let i = 0; i < 11; i++) {
        arr.push({ trigger_data: '0' })
      }
      return arr
    })(),
  },
  // Too many aggregatable trigger data
  {
    aggregatable_trigger_data: (function () {
      const arr = []
      for (let i = 0; i < 51; i++) {
        arr.push({ key_piece: '0x1', source_keys: [] })
      }
      return arr
    })(),
  },
  // Invalid debug_reporting
  {
    debug_reporting: 'true',
  },
]

export const invalidTriggerHeadersAsJSON = [
  // same invalid headers as above, but as JSON
  ...invalidTriggerHeadersAsObjects.map(JSON.stringify),
  // additionally, one invalid JSON example: `` = wrong quotes
  '{"event_trigger_data":[{"trigger_data":`99`}]}',
]
