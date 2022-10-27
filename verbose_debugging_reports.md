Verbose Debugging Reports
=========================

This document is a collection of [verbose debugging
reports](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#optional-verbose-debugging-reports)
that are supported.

### Source debugging reports

Here are the debugging reports supported for [attribution source
registrations](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#registering-attribution-sources).

#### Destination limit reached

* Reasons
  * a source is rejected due to the [destination limit](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#limiting-the-number-of-unique-destinations-covered-by-unexpired-sources)
* Report

```jsonc
{
  "type": "source-destination-limit",
  "body": {
    "limit": 100, // the browser's limit
    "source_event_id": "<source event id in the source registration>",
    "source_site": "https://source.example", // omitted if registered inside a fenced frame tree
    "attribution_destination": "https://destination.example"
  }
}
```

#### Source noised (cookie-based)

* Reasons
  * [noise](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#data-limits-and-noise) is applied to a source event
* Report

```jsonc
{
  "type": "source-noised",
  "body": {
    "source_event_id": "<source event id in the source registration>",
    "source_site": "https://source.example", // omitted if registered inside a fenced frame tree
    "attribution_destination": "https://destination.example"
  }
}
```
