# Verbose Debugging Reports

## Authors

* Arpana Hosabettu (arpanah@chromium.org)
* Nan Lin (linnan@chromium.org)

## Introduction

This document describes the format of [verbose debugging reports][].

The report data is included in the request body as a JSON list of dictionaries.
Each dictionary has a string field `type` and a dictionary field `body`, e.g.:

```json
[{
  "type": "source-destination-limit",
  "body": {
    "attribution_destination": "https://destination.example",
    "limit": "100",
    "source_debug_key": "1234567890",
    "source_event_id": "12340873456",
    "source_site": "https://source.example"
  }
}]
```

The content of the `body` field depends on the `type`.

### Source debugging reports

The following reports are produced in response to [attribution source
registrations][].

The `body` will contain the following fields for all source debugging reports:

* `attribution_destination`: The source registration's parsed `destination`
  sites (i.e. with URLs replaced with sites, duplicates removed, and sorted).
  This will be a string if there was one such site, or a list of strings if
  there were multiple.
* `source_event_id`: The source registration's `source_event_id`.
* `source_site`: The top-level site on which the source registration occurred.

Additionally:

* If the source registration contained a valid `debug_key` and [cookie-based
  debugging][] was allowed, then the `body` will also contain a
  `source_debug_key` field.
* If the source registration was rejected due to an API limit, then the `body`
  will also contain a string-typed `limit` field.

#### `source-channel-capacity-limit`

The source was rejected due to the [channel-capacity limit][].

Additional fields: `limit`

#### `source-destination-limit`

The source was rejected due to the [destination limit][].

Additional fields: `limit`

#### `source-destination-per-day-rate-limit`

The source was rejected due to the
[destinations per source and reporting site per day rate limit][].

Additional fields: `limit`

#### `source-destination-rate-limit`

The source was rejected due to the
[destinations per source and reporting site rate limit][].

Additional fields: `limit`

#### `source-max-event-states-limit`

A source is rejected due to the [event state limit][].

Additional fields: `limit`

#### `source-noised`

The source was successfully registered, but it will not be attributable by any
subsequent trigger because [noise][] has been applied.

The `body` may also include a `source_destination_limit` field if the
[destination limit][] was exceeded.

#### `source-reporting-origin-per-site-limit`

The source was rejected due to the
[reporting origins per source and reporting site limit][].

Additional fields: `limit`

#### `source-scopes-channel-capacity-limit`

The source was rejected due to the [attribution scope channel-capacity limit][].

Additional fields: `limit`

#### `source-storage-limit`

The source was rejected due to a [storage limit][].

Additional fields: `limit`

#### `source-success`

The source was successfully registered **or** the source was rejected for one of
the following reasons:

* [unattributed reporting origin limit][]
* [reporting origins per source and reporting site rate limit][]
* [destinations per source site rate limit][]

These error conditions are deliberately not distinguished from a successful
registration for security purposes.

The `body` may also include a `source_destination_limit` field if the
[destination limit][] was exceeded.

#### `source-trigger-state-cardinality-limit`

The source was rejected due to the [trigger-state cardinality limit][].

Additional fields: `limit`

#### `source-unknown-error`

The source was rejected due to an internal error.

### Trigger debugging reports

The following reports are produced in response to [attribution trigger
registrations][].

The `body` will contain the following fields for all trigger debugging reports
*except* [`trigger-event-low-priority`](#trigger-event-low-priority) and
[`trigger-event-excessive-reports`](#trigger-event-excessive-reports):

* `attribution_destination`: The top-level site on which the trigger
  registration occurred.

Additionally:

* If the trigger registration contained a valid `debug_key` and [cookie-based
  debugging][] was allowed, then the `body` will also contain a
  `trigger_debug_key` field.
* If the trigger registration was rejected due to an API limit, then the `body`
  will also contain a string-typed `limit` field.
* If the trigger was attributed to a source, then the `body` will also contain
  the following fields:
   * `source_event_id`: The source registration's `source_event_id`.
   * `source_site`: The top-level site on which the source registration
      occurred.
   * `source_debug_key`: The source registration's `debug_key`, but omitted if
     the source registration did not contain a valid `debug_key` or
     [cookie-based debugging][] was prohibited.

#### `trigger-aggregate-attributions-per-source-destination-limit`

Aggregatable attribution for the trigger failed due to the
[max attributions rate limit][].

Additional fields: `limit`

#### `trigger-aggregate-deduplicated`

Aggregatable attribution for the trigger was
[deduplicated][aggregatable trigger algorithm].

#### `trigger-aggregate-excessive-reports`

Aggregatable attribution for the trigger failed because the attributed source
had already reached [the maximum number of reports][max aggregatable reports].

Additional fields: `limit`

#### `trigger-aggregate-insufficient-budget`

Aggregatable attribution for the trigger failed because the attributed source
had [insufficient budget][].

Additional fields: `limit`

#### `trigger-aggregate-insufficient-named-budget`

Aggregatable attribution for the trigger failed because the attributed source
had [insufficient named budget][].

Additional fields: `name`, `limit`

#### `trigger-aggregate-no-contributions`

Aggregatable attribution for the trigger failed because no
[histogram contributions][aggregatable trigger algorithm] were produced.

#### `trigger-aggregate-report-window-passed`

Aggregatable attribution for the trigger failed because the attributed source's
aggregatable [report window][attribution trigger algorithm] had passed.

#### `trigger-aggregate-storage-limit`

Aggregatable attribution for the trigger failed due to the
[storage limit][aggregatable storage limit].

Additional fields: `limit`

#### `trigger-event-attributions-per-source-destination-limit`

Event-level attribution for the trigger failed due to the
[max attributions rate limit][].

Additional fields: `limit`

#### `trigger-event-deduplicated`

Event-level attribution for the trigger was [deduplicated][trigger algorithm].

#### `trigger-event-excessive-reports`

Event-level attribution for the trigger failed because the attributed source had
already reached [the maximum number of reports][trigger algorithm].

The `body` will be identical to the [event-level report body][] that would have
been produced had attribution succeeded.

#### `trigger-event-low-priority`

Event-level attribution for the trigger failed because the matching
`event_trigger_data`'s `priority` was [lower][trigger algorithm] than that of
any pending event-level reports for the same source.

The `body` will be identical to the [event-level report body][] that would have
been produced had attribution succeeded.

#### `trigger-event-no-matching-configurations`

Event-level attribution for the trigger failed because no `event_trigger_data`
entry [matched][trigger algorithm] the attributed source.

#### `trigger-event-noise`

Event-level attribution for the trigger failed because the attributed source was
subject to [noise][].

#### `trigger-event-report-window-not-started`

Event-level attribution for the trigger failed because the attributed source's
event-level [report window][attribution source registrations] hadn't begun.

#### `trigger-event-report-window-passed`

Event-level attribution for the trigger failed because the attributed source's
event-level [report window][attribution source registrations] had passed.

#### `trigger-event-storage-limit`

Event-level attribution for the trigger failed due to the [storage limit][].

Additional fields: `limit`

#### `trigger-no-matching-filter-data`

The trigger was rejected because its top-level filters did not match the
attributed source's [filter data][].

#### `trigger-no-matching-source`

The trigger was rejected because its <reporting origin, destination site> pair
could not be [matched][trigger algorithm] to a source.

#### `trigger-reporting-origin-limit`

The trigger was rejected due to the [attributed reporting origin limit][].

Additional fields: `limit`

#### `trigger-unknown-error`

The trigger was rejected due to an internal error.

[aggregatable storage limit]: https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md#storage-limits
[aggregatable trigger algorithm]: https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md#attribution-trigger-registration
[attributed reporting origin limit]: https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#reporting-origin-limits
[attribution scope channel-capacity limit]: https://wicg.github.io/attribution-reporting-api/#max-event-level-attribution-scope-channel-capacity-per-source
[attribution source registrations]: https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#registering-attribution-sources
[attribution trigger registrations]: https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#triggering-attribution
[channel-capacity limit]: https://wicg.github.io/attribution-reporting-api/#max-event-level-channel-capacity-per-source
[cookie-based debugging]: https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#optional-cookie-based-debugging-reports
[destination limit]: https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#limiting-the-number-of-unique-destinations-covered-by-unexpired-sources
[destinations per source and reporting site per day rate limit]: https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#limiting-the-number-of-unique-destinations-covered-by-unexpired-sources
[destinations per source and reporting site rate limit]: https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#limiting-the-number-of-unique-destinations-per-source-site
[destinations per source site rate limit]: https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#limiting-the-number-of-unique-destinations-per-source-site
[event state limit]: https://wicg.github.io/attribution-reporting-api/#attribution-scopes-max-event-states
[event-level report body]: https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#attribution-reports
[filter data]: https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#optional-attribution-filters
[insufficient budget]: https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md#contribution-bounding-and-budgeting
[insufficient named budget]: https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md#optional-named-budgets
[max aggregatable reports]: https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md#hide-the-true-number-of-attribution-reports
[max attributions rate limit]: https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#reporting-cooldown--rate-limits
[noise]: https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#data-limits-and-noise
[reporting origins per source and reporting site limit]: https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#reporting-origin-limits
[reporting origins per source and reporting site rate limit]: https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#reporting-origin-limits
[specification]: https://wicg.github.io/attribution-reporting-api/#obtain-and-deliver-a-verbose-debug-report-on-source-registration
[storage limit]: https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#storage-limits
[trigger algorithm]: https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#trigger-attribution-algorithm
[trigger-state cardinality limit]: https://wicg.github.io/attribution-reporting-api/#max-trigger-state-cardinality
[unattributed reporting origin limit]: https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#reporting-origin-limits
[verbose debugging reports]: https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#verbose-debugging-reports
