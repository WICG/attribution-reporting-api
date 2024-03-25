Verbose Debugging Reports
=========================

This document is a collection of [verbose debugging
reports](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#verbose-debugging-reports)
that are supported.

### Source debugging reports

Here are the debugging reports supported for [attribution source
registrations](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#registering-attribution-sources).

#### `source-destination-limit`
A source is rejected due to the [destination limit](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#limiting-the-number-of-unique-destinations-covered-by-unexpired-sources).

#### `source-noised`
[Noise](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#data-limits-and-noise) is applied to a source event.

#### `source-storage-limit`
A source is rejected due to the [storage limit](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#storage-limits).

#### `source-success`
A source is successfully registered. Note that this is also sent when a source
is rejected due to the following limits to mitigate security concerns:
* [unattributed reporting origin limit](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#reporting-origin-limits)
* [reporting origins per source and reporting site rate limit](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#reporting-origin-limits)
* [destinations per source site rate limit](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#limiting-the-number-of-unique-destinations-per-source-site).

#### `source-destination-rate-limit`
A source is rejected due to the [destinations per source and reporting site rate limit](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#limiting-the-number-of-unique-destinations-per-source-site).

#### `source-unknown-error`
System error.

### Trigger debugging reports

Here are the debugging reports supported for [attribution trigger
registrations](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#triggering-attribution).

#### `trigger-no-matching-source`
A trigger is rejected due to no matching sources in storage that match <reporting origin, destination site> (see [algorithm](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#trigger-attribution-algorithm)).

#### `trigger-no-matching-filter-data`
A trigger is rejected due to no [matching filter data](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#optional-attribution-filters).

#### `trigger-event-attributions-per-source-destination-limit`
An event-level report is rejected due to the [max attributions rate limit](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#reporting-cooldown--rate-limits).

#### `trigger-aggregate-attributions-per-source-destination-limit`
An aggregatable report is rejected due to the [max attributions rate limit](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#reporting-cooldown--rate-limits).

#### `trigger-reporting-origin-limit`
A trigger is rejected due to the [attributed reporting origin limit](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#reporting-origin-limits).

#### `trigger-event-deduplicated`
An event-level report is not created due to [deduplication](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#trigger-attribution-algorithm).

#### `trigger-event-no-matching-configurations`
An event-level report is not created due to no [matching event triggers](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#optional-attribution-filters).

#### `trigger-event-noise`
An event-level report is dropped due to the [noise](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#data-limits-and-noise) applied to the source.

#### `trigger-event-low-priority`
An event-level report is dropped due to [too low priority](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#trigger-attribution-algorithm).

#### `trigger-event-excessive-reports`
An event-level report is dropped as the [maximum number of reports](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#trigger-attribution-algorithm) have been scheduled for the source.

#### `trigger-event-storage-limit`
An event-level report is not created due to the [storage limit](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#storage-limits).

#### `trigger-event-report-window-not-started`
An event-level report is not created as the [report window](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#registering-attribution-sources) has not started.

#### `trigger-event-report-window-passed`
An event-level report is not created as the [report window](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#registering-attribution-sources) has passed.

#### `trigger-aggregate-deduplicated`
An aggregatable report is not created due to [deduplication](https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md#attribution-trigger-registration).

#### `trigger-aggregate-no-contributions`
An aggregatable report is not created as no [histogram contributions](https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md#attribution-trigger-registration) are created.

#### `trigger-aggregate-excessive-reports`
An aggregatable report is dropped as the [maximum number of reports](https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md#hide-the-true-number-of-attribution-reports) have been scheduled for the source.

#### `trigger-aggregate-insufficient-budget`
An aggregatable report is dropped due to [insufficient budget](https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md#contribution-bounding-and-budgeting).

#### `trigger-aggregate-storage-limit`
An aggregatable report is not created due to the [storage limit](https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md#storage-limits).

#### `trigger-aggregate-report-window-passed`
An aggregatable report is not created as the [report window](https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md#attribution-source-registration) has passed.

#### `trigger-unknown-error`
System error.

### Report data

The report data is included in the request body as a JSON list of objects, and
each object has a string field `type` and a dictionary field `body`, e.g.:

```jsonc
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

The `body` field is identical to the event-level report body if `type` is
[`trigger-event-low-priority`](#trigger-event-low-priority) or [`trigger-event-excessive-reports`](#trigger-event-excessive-reports),
otherwise the dictionary may include the following fields:
* `attribution_destination`: The site on which attribution did/would occur, e.g. `"https://destination.example"`.
* `limit`: The browser's limit enforced, e.g. `"100"`.
* `source_debug_key`: The debug key in the source registration, omitted if not set.
* `source_event_id`: The source event id in the source registration.
* `source_site`: The site on which source was registered, e.g. `"https://source.example"`.
* `trigger_debug_key`: The debug key in the trigger registration, omitted if not set.

This table defines the fields in the `body` dictionary.

| `type` | `attribution_destination`| `limit` | `source_debug_key` | `source_event_id` | `source_site` | `trigger_debug_key` |
| --- | --- | --- | --- | --- | --- | --- |
| [`source-destination-limit`](#source-destination-limit) | ✓ | ✓ | ✓ | ✓ | ✓ | ❌ |
| [`source-noised`](#source-noised) | ✓ | ❌ | ✓ | ✓ | ✓ | ❌ |
| [`source-storage-limit`](#source-storage-limit) | ✓ | ✓ | ✓ | ✓ | ✓ | ❌ |
| [`source-success`](#source-success) | ✓ | ❌ | ✓ | ✓ | ✓ | ❌ |
| [`source-unknown-error`](#source-unknown-error) | ✓ | ❌ | ✓ | ✓ | ✓ | ❌ |
| [`trigger-no-matching-source`](#trigger-no-matching-source) | ✓ | ❌ | ❌ | ❌ | ❌ | ✓ |
| [`trigger-no-matching-filter-data`](#trigger-no-matching-filter-data) | ✓ | ❌ | ✓ | ✓ | ✓ | ✓ |
| [`trigger-attributions-per-source-destination-limit`](#trigger-attributions-per-source-destination-limit) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| [`trigger-reporting-origin-limit`](#trigger-reporting-origin-limit) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| [`trigger-event-deduplicated`](#trigger-event-deduplicated) | ✓ | ❌ | ✓ | ✓ | ✓ | ✓ |
| [`trigger-event-no-matching-configurations`](#trigger-event-no-matching-configurations) | ✓ | ❌ | ✓ | ✓ | ✓ | ✓ |
| [`trigger-event-noise`](#trigger-event-noise) | ✓ | ❌ | ✓ | ✓ | ✓ | ✓ |
| [`trigger-event-storage-limit`](#trigger-event-storage-limit) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| [`trigger-event-report-window-not-started`](#trigger-event-report-window-not-started) | ✓ | ❌ | ✓ | ✓ | ✓ | ✓ |
| [`trigger-event-report-window-passed`](#trigger-event-report-window-passed) | ✓ | ❌ | ✓ | ✓ | ✓ | ✓ |
| [`trigger-aggregate-deduplicated`](#trigger-aggregate-deduplicated) | ✓ | ❌ | ✓ | ✓ | ✓ | ✓ |
| [`trigger-aggregate-excessive-reports`](#trigger-aggregate-excessive-reports) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| [`trigger-aggregate-no-contributions`](#trigger-aggregate-no-contributions) | ✓ | ❌ | ✓ | ✓ | ✓ | ✓ |
| [`trigger-aggregate-insufficient-budget`](#trigger-aggregate-insufficient-budget) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| [`trigger-aggregate-storage-limit`](#trigger-aggregate-storage-limit) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| [`trigger-aggregate-report-window-passed`](#trigger-aggregate-report-window-passed) | ✓ | ❌ | ✓ | ✓ | ✓ | ✓ |
| [`trigger-unknown-error`](#trigger-unknown-error) | ✓ | ❌ | ✓ | ✓ | ✓ | ✓ |
