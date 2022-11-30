Verbose Debugging Reports
=========================

This document is a collection of [verbose debugging
reports](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#optional-verbose-debugging-reports)
that are supported.

### Source debugging reports

Here are the debugging reports supported for [attribution source
registrations](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#registering-attribution-sources).

* `source-destination-limit`: a source is rejected due to the [destination limit](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#limiting-the-number-of-unique-destinations-covered-by-unexpired-sources).

* `source-noised` (cookie-based): [noise](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#data-limits-and-noise) is applied to a source event.

* `source-storage-limit` (cookie-based): a source is rejected due to the [storage limit](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#storage-limits).

* `source-unknown-error` (cookie-based): system error.

### Trigger debugging reports (cookie-based)

Here are the debugging reports supported for [attribution trigger
registrations](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#triggering-attribution).

* `trigger-no-matching-source`: a trigger is rejected due to no matching sources in storage that match <`attributionsrc` origin, `destination`> (see [algorithm](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#trigger-attribution-algorithm)).

* `trigger-no-matching-filter-data`: a trigger is rejected due to no [matching filter data](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#optional-attribution-filters).

* `trigger-attributions-per-source-destination-limit`: a trigger is rejected due to the [max attributions rate limit](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#reporting-cooldown--rate-limits).

* `trigger-reporting-origin-limit`: a trigger is rejected due to the [attributed reporting origin limit](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#reporting-origin-limits).

* `trigger-event-deduplicated`: an event-level report is not created due to
    [deduplication](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#trigger-attribution-algorithm).

* `trigger-event-no-matching-configurations`: an event-level report is not created due to no
    [matching event triggers](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#optional-attribution-filters).

* `trigger-event-noise`: an event-level report is dropped due to the
    [noise](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#data-limits-and-noise) applied to the source.

* `trigger-event-low-priority`: an event-level report is dropped due to [too low priority](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#trigger-attribution-algorithm).

* `trigger-event-excessive-reports`: an event-level report is dropped as the [maximum number of reports](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#trigger-attribution-algorithm) have been scheduled for the source.

* `trigger-event-storage-limit`: an event-level report is not created due to the [storage limit](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#storage-limits).

* `trigger-event-report-window-passed`: an event-level report is not created as the [report window](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#registering-attribution-sources) has passed.

* `trigger-aggregate-deduplicated`: an aggregatable report is not created due to
    [deduplication](https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md#attribution-trigger-registration).

* `trigger-aggregate-no-contributions`: an aggregatable report is not created as no [histogram contributions](https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md#attribution-trigger-registration) are created.

* `trigger-aggregate-insufficient-budget`: an aggregatable report is dropped due to [insufficient budget](https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md#contribution-bounding-and-budgeting).

* `trigger-aggregate-storage-limit`: an aggregatable report is not created due to the [storage limit](https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md#storage-limits).

* `trigger-aggregate-report-window-passed`: an aggregatable report is not created as the [report window](https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md#attribution-source-registration) has passed.

* `trigger-unknown-error`: system error.

### Report data

The report data is included in the requested body as a JSON list of objects, and
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
`source-event-low-priority` or `source-event-excessive-reports`, otherwise the
dictionary may include the following fields:
* `attribution_destination`: The site on which attribution did/would occur, e.g. `"https://destination.example"`.
* `limit`: The browser's limit enforced, e.g. `"100"`.
* `source_debug_key`: The debug key in the source registration, omitted if not set.
* `source_event_id`: The source event id in the source registration.
* `source_site`: The site on which source was registered, e.g. `"https://source.example"`.
* `trigger_debug_key`: The debug key in the trigger registration, omitted if not set.

This table defines the fields in the `body` dictionary.

| `type` | `attribution_destination`| `limit` | `source_debug_key` | `source_event_id` | `source_site` | ` trigger_debug_key` |
| --- | --- | --- | --- | --- | --- | --- |
| `source-destination-limit` | ✓ | ✓ | ✓ | ✓ | ✓ | ❌ |
| `source-noised` | ✓ | ❌ | ✓ | ✓ | ✓ | ❌ |
| `source-storage-limit` | ✓ | ✓ | ✓ | ✓ | ✓ | ❌ |
| `source-unknown-error` | ✓ | ❌ | ✓ | ✓ | ✓ | ❌ |
| `trigger-no-matching-source` | ✓ | ❌ | ❌ | ❌ | ❌ | ✓ |
| `trigger-no-matching-filter-data` | ✓ | ❌ | ✓ | ✓ | ✓ | ✓ |
| `trigger-attributions-per-source-destination-limit` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `trigger-reporting-origin-limit` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `trigger-event-deduplicated` | ✓ | ❌ | ✓ | ✓ | ✓ | ✓ |
| `trigger-event-no-matching-configurations` | ✓ | ❌ | ✓ | ✓ | ✓ | ✓ |
| `trigger-event-noise` | ✓ | ❌ | ✓ | ✓ | ✓ | ✓ |
| `trigger-event-storage-limit` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `trigger-event-report-window-passed` | ✓ | ❌ | ✓ | ✓ | ✓ | ✓ |
| `trigger-aggregate-deduplicated` | ✓ | ❌ | ✓ | ✓ | ✓ | ✓ |
| `trigger-aggregate-no-contributions` | ✓ | ❌ | ✓ | ✓ | ✓ | ✓ |
| `trigger-aggregate-insufficient-budget` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `trigger-aggregate-storage-limit` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `trigger-aggregate-report-window-passed` | ✓ | ❌ | ✓ | ✓ | ✓ | ✓ |
| `trigger-unknown-error` | ✓ | ❌ | ✓ | ✓ | ✓ | ✓ |


