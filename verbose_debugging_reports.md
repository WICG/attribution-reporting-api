Verbose Debugging Reports
=========================

This document is a collection of [verbose debugging
reports](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#optional-verbose-debugging-reports)
that are supported.

### Source debugging reports

Here are the debugging reports supported for [attribution source
registrations](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#registering-attribution-sources).

#### Destination limit reached

* Reason
  * a source is rejected due to the [destination limit](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#limiting-the-number-of-unique-destinations-covered-by-unexpired-sources)
* Report

```jsonc
{
  "type": "source-destination-limit",
  "body": {
    "attribution_destination": "https://destination.example",
    "limit": "100", // the browser's limit
    "source_debug_key": "<debug key in the source registration>", // omitted if not set
    "source_event_id": "<source event id in the source registration>",
    "source_site": "https://source.example"
  }
}
```

#### Source noised (cookie-based)

* Reason
  * [noise](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#data-limits-and-noise) is applied to a source event
* Report

```jsonc
{
  "type": "source-noised",
  "body": {
    "attribution_destination": "https://destination.example",
    "source_debug_key": "<debug key in the source registration>", // omitted if not set
    "source_event_id": "<source event id in the source registration>",
    "source_site": "https://source.example"
  }
}
```

#### Source storage limit reached (cookie-based)

* Reason
  * a source is rejected due to the [storage limit](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#storage-limits)
* Report

```jsonc
{
  "type": "source-storage-limit",
  "body": {
    "attribution_destination": "https://destination.example",
    "limit": "1024" // the browser's limit
    "source_debug_key": "<debug key in the source registration>", // omitted if not set
    "source_event_id": "<source event id in the source registration>",
    "source_site": "https://source.example"
  }
}
```

#### Source unknown error (cookie-based)

* Reason
  * System error.
* Report

```jsonc
{
  "type": "source-unknown-error",
  "body": {
    "attribution_destination": "https://destination.example",
    "source_debug_key": "<debug key in the source registration>", // omitted if not set
    "source_event_id": "<source event id in the source registration>",
    "source_site": "https://source.example"
  }
}
```

### Trigger debugging reports (cookie-based)

Here are the debugging reports supported for [attribution trigger
registrations](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#triggering-attribution).

#### No matching source

* Reason
  * a trigger is rejected due to no matching sources in storage that match <`attributionsrc` origin, `destination`> (see [algorithm](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#trigger-attribution-algorithm)).
* Report

```jsonc
{
  "type": "trigger-no-matching-source",
  "body": {
    "attribution_destination": "https://destination.example",
    "trigger_debug_key": "<debug key in trigger registration>" // omitted if not set
  }
}
```

#### No matching filter data

* Reason
  * a trigger is rejected due to no [matching filter data](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#optional-attribution-filters).
* Report

```jsonc
{
  "type": "trigger-no-matching-filter-data",
  "body": {
    "attribution_destination": "https://destination.example",
    "source_debug_key": "<debug key in source registration>", // omitted if not set
    "source_event_id": "<source event id in the matched source>",
    "source_site": "https://source.example",
    "trigger_debug_key": "<debug key in trigger registration>" // omitted if not set
  }
}
```

####  Max attributions rate limit reached

* Reason
  * a trigger is rejected due to the [max attributions rate limit](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#reporting-cooldown--rate-limits).
* Report

```jsonc
{
  "type": "trigger-attributions-per-source-destination-limit",
  "body": {
    "attribution_destination": "https://destination.example",
    "limit": "100", // the browser's limit
    "source_debug_key": "<debug key in source registration>", // omitted if not set
    "source_event_id": "<source event id in the matched source>",
    "source_site": "https://source.example",
    "trigger_debug_key": "<debug key in trigger registration>" // omitted if not set
  }
}
```

#### Attributed reporting origin limit reached

* Reason
  * a trigger is rejected due to the [attributed reporting origin limit](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#reporting-origin-limits).
* Report

```jsonc
{
  "type": "trigger-reporting-origin-limit",
  "body": {
    "attribution_destination": "https://destination.example",
    "limit": "10", // the browser's limit
    "source_debug_key": "<debug key in source registration>", // omitted if not set
    "source_event_id": "<source event id in the matched source>",
    "source_site": "https://source.example",
    "trigger_debug_key": "<debug key in trigger registration>" // omitted if not set
  }
}
```

#### Event-level trigger deduplicated

* Reason
  * an event-level report is not created due to
    [deduplication](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#trigger-attribution-algorithm).
* Report

```jsonc
{
  "type": "trigger-event-deduplicated",
  "body": {
    "attribution_destination": "https://destination.example",
    "source_debug_key": "<debug key in source registration>", // omitted if not set
    "source_event_id": "<source event id in the matched source>",
    "source_site": "https://source.example",
    "trigger_debug_key": "<debug key in trigger registration>" // omitted if not set
  }
}
```

#### No matching event-level trigger configurations

* Reason
  * an event-level report is not created due to no
    [matching event triggers](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#optional-attribution-filters).
* Report

```jsonc
{
  "type": "trigger-event-no-matching-configurations",
  "body": {
    "attribution_destination": "https://destination.example",
    "source_debug_key": "<debug key in source registration>", // omitted if not set
    "source_event_id": "<source event id in the matched source>",
    "source_site": "https://source.example",
    "trigger_debug_key": "<debug key in trigger registration>" // omitted if not set
  }
}
```

#### Event-level report dropped for noise

* Reason
  * an event-level report is dropped due to the
    [noise](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#data-limits-and-noise) applied to the source.
* Report

```jsonc
{
  "type": "trigger-event-noise",
  "body": {
    "attribution_destination": "https://destination.example",
    "source_debug_key": "<debug key in source registration>", // omitted if not set
    "source_event_id": "<source event id in the matched source>",
    "source_site": "https://source.example",
    "trigger_debug_key": "<debug key in trigger registration>" // omitted if not set
  }
}
```

#### Low priority event-level report dropped

* Reason
  * an event-level report is dropped due to [too low priority](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#trigger-attribution-algorithm).
* Report

```jsonc
{
  "type": "trigger-event-low-priority",
  "body": {
    // see event-level report fields
  }
}
```

#### Excessive event-level reports dropped

* Reason
  * an event-level report is dropped as the [maximum number of reports](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#trigger-attribution-algorithm) have been scheduled for the source.
* Report

```jsonc
{
  "type": "trigger-event-excessive-reports",
  "body": {
    // see event-level report fields
  }
}
```

#### Event-level report storage limit reached

* Reason
  * an event-level report is not created due to the [storage limit](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#storage-limits).
* Report

```jsonc
{
  "type": "trigger-event-storage-limit",
  "body": {
    "attribution_destination": "https://destination.example",
    "limit": "1024", // the browser's limit
    "source_debug_key": "<debug key in source registration>", // omitted if not set
    "source_event_id": "<source event id in the matched source>",
    "source_site": "https://source.example",
    "trigger_debug_key": "<debug key in trigger registration>" // omitted if not set
  }
}
```

#### Aggregatable trigger deduplication

* Reason
  * an aggregatable report is not created due to
    [deduplication](https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md#attribution-trigger-registration).
* Report

```jsonc
{
  "type": "trigger-aggregate-deduplicated",
  "body": {
    "attribution_destination": "https://destination.example",
    "source_debug_key": "<debug key in source registration>", // omitted if not set
    "source_event_id": "<source event id in the matched source>",
    "source_site": "https://source.example",
    "trigger_debug_key": "<debug key in trigger registration>" // omitted if not set
  }
}
```

#### No aggregatable contributions

* Reason
  * an aggregatable report is not created as no [histogram contributions](https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md#attribution-trigger-registration) are created.
* Report

```jsonc
{
  "type": "trigger-aggregate-no-contributions",
  "body": {
    "attribution_destination": "https://destination.example",
    "source_debug_key": "<debug key in source registration>", // omitted if not set
    "source_event_id": "<source event id in the matched source>",
    "source_site": "https://source.example",
    "trigger_debug_key": "<debug key in trigger registration>" // omitted if not set
  }
}
```


#### Insufficient aggregatable budget

* Reason
  * an aggregatable report is dropped due to [insufficient budget](https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md#contribution-bounding-and-budgeting).
* Report

```jsonc
{
  "type": "trigger-aggregate-insufficient-budget",
  "body": {
    "attribution_destination": "https://destination.example",
    "limit": "65536", // the browser's limit
    "source_debug_key": "<debug key in source registration>", // omitted if not set
    "source_event_id": "<source event id in the matched source>",
    "source_site": "https://source.example",
    "trigger_debug_key": "<debug key in trigger registration>" // omitted if not set
  }
}
```

#### Aggregatable report storage limit reached

* Reason
  * an aggregatable report is not created due to the [storage limit](https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md#storage-limits).
* Report

```jsonc
{
  "type": "trigger-aggregate-storage-limit",
  "body": {
    "attribution_destination": "https://destination.example",
    "limit": "1024", // the browser's limit
    "source_debug_key": "<debug key in source registration>", // omitted if not set
    "source_event_id": "<source event id in the matched source>",
    "source_site": "https://source.example",
    "trigger_debug_key": "<debug key in trigger registration>" // omitted if not set
  }
}
```

#### Trigger unknown error

* Reason
  * System error.
* Report

```jsonc
{
  "type": "trigger-unknown-error",
  "body": {
    "attribution_destination": "https://destination.example",
    "source_debug_key": "<debug key in source registration>", // omitted if unavailable or not set
    "source_event_id": "<source event id in the matched source>", // omitted if unavailable
    "source_site": "https://source.example", // omitted if unavailable
    "trigger_debug_key": "<debug key in trigger registration>" // omitted if not set
  }
}
```

