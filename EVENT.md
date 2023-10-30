_This is an in-depth technical explainer. If you're looking for a high-level
introduction to Attribution Reporting with event-level reports, head over to
[Event-level reports in the Attribution Reporting API](https://developer.chrome.com/docs/privacy-sandbox/attribution-reporting-event-introduction/)._

_A list of all API guides and blog posts for this API is also available
[here](https://developer.chrome.com/docs/privacy-sandbox/attribution-reporting/)._

# Attribution Reporting with event-level reports

This document is an explainer for a potential new web platform feature which
allows for measuring and reporting ad click and view conversions.

See the explainer on [aggregate measurement](AGGREGATE.md) for a potential
extension on top of this.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

- [Motivation](#motivation)
- [Related work](#related-work)
- [API Overview](#api-overview)
  - [Registering attribution sources](#registering-attribution-sources)
  - [Handling an attribution source event](#handling-an-attribution-source-event)
  - [Publisher-side Controls for Attribution Source Declaration](#publisher-side-controls-for-attribution-source-declaration)
  - [Triggering Attribution](#triggering-attribution)
  - [Registration requests](#registration-requests)
  - [Data limits and noise](#data-limits-and-noise)
  - [Trigger attribution algorithm](#trigger-attribution-algorithm)
  - [Multiple sources for the same trigger (Multi-touch)](#multiple-sources-for-the-same-trigger-multi-touch)
  - [Sending Scheduled Reports](#sending-scheduled-reports)
  - [Attribution Reports](#attribution-reports)
  - [Data Encoding](#data-encoding)
  - [Optional attribution filters](#optional-attribution-filters)
    - [Reserved keys](#reserved-keys)
    - [Lookback window](#lookback-window)
  - [Optional: Varying frequency and number of reports](#optional-varying-frequency-and-number-of-reports)
    - [Example](#example)
  - [Optional: transitional debugging reports](#optional-transitional-debugging-reports)
    - [Attribution-success debugging reports](#attribution-success-debugging-reports)
    - [Verbose debugging reports](#verbose-debugging-reports)
      - [Reporting endpoints](#reporting-endpoints)
- [Sample Usage](#sample-usage)
  - [Noisy fake conversion example](#noisy-fake-conversion-example)
- [Storage limits](#storage-limits)
- [Privacy Considerations](#privacy-considerations)
  - [Trigger Data](#trigger-data)
  - [Reporting Delay](#reporting-delay)
  - [Reporting origin limits](#reporting-origin-limits)
  - [Clearing Site Data](#clearing-site-data)
  - [Reporting cooldown / rate limits](#reporting-cooldown--rate-limits)
  - [Less trigger-side data](#less-trigger-side-data)
  - [Browsing history reconstruction](#browsing-history-reconstruction)
    - [Adding noise to whether a trigger is genuine](#adding-noise-to-whether-a-trigger-is-genuine)
    - [Limiting the number of unique destinations covered by unexpired sources](#limiting-the-number-of-unique-destinations-covered-by-unexpired-sources)
    - [Limiting the number of unique destinations per source site](#limiting-the-number-of-unique-destinations-per-source-site)
  - [Differential privacy](#differential-privacy)
  - [Speculative: Limits based on first party storage](#speculative-limits-based-on-first-party-storage)
- [Security considerations](#security-considerations)
  - [Reporting origin control](#reporting-origin-control)
  - [Denial of service](#denial-of-service)
  - [Top site permission model](#top-site-permission-model)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Motivation

Currently, the web ad industry measures conversions via identifiers they can
associate across sites. These identifiers tie information about which ads were
clicked to information about activity on the advertiser's site (the conversion).
This allows advertisers to measure ROI, and for the entire ads ecosystem to
understand how well ads perform.

Since the ads industry today uses common identifiers across advertiser and
publisher sites to track conversions, these common identifiers can be used to
enable other forms of cross-site tracking.

This doesn’t have to be the case, though, especially in cases where identifiers
such as third-party cookies are either unavailable or undesirable. A new API
surface can be added to the web platform to satisfy this use case without them,
in a way that provides better privacy to users.

This API alone will not be able to support all conversion measurement use cases.
We envision this API as one of potentially many new APIs that will seek to
reproduce valid advertising use cases in the web platform in a privacy-preserving
way. In particular, we think this API could be extended by using
server-side aggregation to provide richer data, which we are continuing to
explore.

## Related work

There is an alternative [Private Click
Measurement](https://github.com/privacycg/private-click-measurement) draft spec
in the PrivacyCG. See this [WebKit blog
post](https://webkit.org/blog/8943/privacy-preserving-ad-click-attribution-for-the-web/)
for more details.

There are multiple aggregate designs in
[wicg/privacy-preserving-ads](https://github.com/WICG/privacy-preserving-ads),
including Bucketization and MaskedLARK.

Folks from Meta and Mozilla have published the [Interoperable Private
Attribution(IPA)](https://docs.google.com/document/d/1KpdSKD8-Rn0bWPTu4UtK54ks0yv2j22pA5SrAD9av4s/edit#heading=h.f4x9f0nqv28x)
proposal for doing aggregate attribution measurement.

Brave has published and implemented an [Ads Confirmation
Protocol](https://github.com/brave/brave-browser/wiki/Security-and-privacy-model-for-ad-confirmations).

## API Overview

### Registering attribution sources

Attribution sources are events which future triggers can be attributed to.

Sources are registered by returning a new HTTP response header on requests
which are eligible for attribution. A request is eligible as long as it has
the `Attribution-Reporting-Eligible` request header.

There are two types of attribution sources, `navigation` sources and `event`
sources.

`navigation` sources are registered via clicks on anchor tags:
```html
<a href="https://advertiser.example/landing"
   attributionsrc="https://adtech.example/attribution_source?my_ad_id=123">
   click me
</a>
```
or via calls to `window.open` that occur with [transient
activation](https://html.spec.whatwg.org/multipage/interaction.html#transient-activation):
```javascript
// Encode the attributionsrc URL in case it contains special characters, such as '=', that will
// cause the parameter to be improperly parsed
const encoded = encodeURIComponent('https://adtech.example/attribution_source?my_ad_id=123');
window.open(
  "https://advertiser.example/landing",
  "_blank",
  `attributionsrc=${encoded}`);
```

`event` sources do not require any user interaction and can be registered via
`<img>` or `<script>` tags with the new `attributionsrc` attribute:
```html
<img src="https://advertiser.example/pixel"
     attributionsrc="https://adtech.example/attribution_source?my_ad_id=123">

<script src="https://advertiser.example/register-view"
        attributionsrc="https://adtech.example/attribution_source?my_ad_id=123">
```

The `attributionsrc` attribute on `<a>`, `<img>`, and `<script>` may be empty or
non-empty. If it is non-empty, it contains a space-separated list of URLs
to which the browser will initiate a separate `keepalive` fetch request in the
background. If it is empty, no background requests will be made. In both
cases, the request(s) (originating from `href`, `src`, or `attributionsrc`) will
contain an `Attribution-Reporting-Eligible` header that indicates the types of
registrations that are allowed in the response.

For `<a>` and `window.open`, background requests, if any, are made when the user
navigates. For `<img>` and `<script>`, background requests are made when the
`attributionsrc` attribute is set on the DOM element.

In JavaScript, `window.open` also supports an empty or non-empty
`attributionsrc` feature. The feature may appear multiple times with a value to
indicate that multiple background requests should be made:

```javascript
const url1 = encodeURIComponent('https://adtech1.example');
const url2 = encodeURIComponent('https://adtech2.example');
window.open(
  'https://advertiser.example/landing',
  '_blank',
  `attributionsrc=${url1} attributionsrc=${url2}`);
```

`event` sources can also be registered using existing JavaScript request
APIs by setting the appropriate option:

```javascript
const attributionReporting = {
  eventSourceEligible: true,
  triggerEligible: false,
};
// Optionally set keepalive to ensure the request outlives the page.
window.fetch("https://adtech.example/attribution_source?my_ad_id=123",
             { keepalive: true, attributionReporting });
```

The response to these requests will configure the API via a new JSON-encoded HTTP
header called `Attribution-Reporting-Register-Source` of the form:

```jsonc
{
  "destination": "[eTLD+1]",
  "source_event_id": "[64-bit unsigned integer]",
  "expiry": "[64-bit signed integer]",
  "priority": "[64-bit signed integer]",
  "event_report_window": "[64-bit signed integer]",
}
```

- `destination`: Required. An origin whose eTLD+1 is where attribution will be triggered
for this source. The field may also be specified as a list (JSON array) of no more than three elements.

- `source_event_id`: Optional. A string encoding a 64-bit unsigned integer which
represents the event-level data associated with this source. This will be
limited to 64 bits of information but the value can vary. Defaults to 0.

- `expiry`: Optional. A duration in seconds from registration after which the source can no longer
be attributed. Defaults to 30 days, which is also the maximum. The minimum is 1
day. For event sources, this is rounded to the nearest day.

- `priority`: Optional. A signed 64-bit integer used to prioritize
this source with respect to other matching sources. When a trigger is
registered, the browser finds the matching source with highest
`priority` value and generates a report. The other sources will not
generate reports. Defaults to 0.

- `event_report_window`: Optional. A duration in seconds from registration
during which reports may be created for this source. Also controls the last
window in which reports will be sent. The minimum value is 3600 seconds (1 hour).
The maximum value is `expiry`.

Once this header is received, the browser will proceed with [handling an
attribution source event](#handling-an-attribution-source-event). Note that it
is possible to register multiple sources for the same request using HTTP
redirects.

Note that we sometimes call the `attributionsrc`'s origin the "reporting origin"
since it is the origin that will end up receiving attribution reports.

### Handling an attribution source event

A `navigation` attribution source stored only if the navigation occurs with [transient
user activation](https://html.spec.whatwg.org/multipage/interaction.html#transient-activation). `event` sources don’t require activation.

An attribution source is eligible for reporting if any page on any of the
associated `destination` eTLD+1s (advertiser sites) triggers attribution for the associated
reporting origin.

### Publisher-side Controls for Attribution Source Declaration

This API is governed by a [Permissions Policy](https://www.w3.org/TR/permissions-policy/) with
a default allowlist of `*`. This means that publishers can opt out of the API for themselves or
third parties, but by default anyone on the page can use the API. See
[issue 558](https://github.com/WICG/attribution-reporting-api/issues/558) for more details.

### Triggering Attribution

Attribution can only be triggered for a source on a page whose eTLD+1 matches
the eTLD+1 of one of the sites provided in `destination`. To trigger attribution, a
similar mechanism is used as source event registration, via HTML:
```html
<img src="https://ad-tech.example/conversionpixel"
     attributionsrc="https://adtech.example/attribution_trigger?purchase=13">
```
or JavaScript:
```javascript
const attributionReporting = {
  eventSourceEligible: false,
  triggerEligible: true,
};
// Optionally set keepalive to ensure the request outlives the page.
window.fetch("https://adtech.example/attribution_trigger?purchase=13",
             { keepalive: true, attributionReporting });
```

As a stop-gap to support pre-existing conversion tags which do not include the
`attributionsrc` attribute, or use a different Fetch API, the browser will also
process trigger registration headers for all subresource requests on the page
where the `attribution-reporting` Permissions Policy is enabled.

Like source registrations, these requests should respond with a new HTTP
header called `Attribution-Reporting-Register-Trigger`, which contains information
about how to treat the trigger:
```jsonc
{
  "event_trigger_data": [{
    "trigger_data": "[unsigned 64-bit integer]",
    "priority": "[signed 64-bit integer]",
    "deduplication_key": "[unsigned 64-bit integer]"
  }]
}
```

- `trigger_data`: Optional. Coarse-grained data to identify the trigger.
  The value will be limited [depending on the
  attributed source type](#data-limits-and-noise). Defaults to 0.
- `priority`: Optional. A signed 64-bit integer representing the priority
of this trigger compared to other triggers for the same source. Defaults to 0.
- `deduplication_key`: Optional. An unsigned 64-bit integer that will be used to
deduplicate multiple triggers that contain the same `deduplication_key` for a
single source. Defaults to no deduplication.

When this header is received, the browser will schedule an attribution report as
detailed in [Trigger attribution algorithm](#trigger-attribution-algorithm).
Note that the header can be present on redirect requests.

Triggering attribution requires the `attribution-reporting` Permissions Policy
to be enabled in the context the request is made. See [Publisher
Controls for Attribution Source
Declaration](#publisher-side-controls-for-attribution-source-declaration).

By default, navigation sources may be attributed up to 3 times. Event sources may be
attributed up to 1 time.

### Registration requests

Depending on the context in which it was made, a request is eligible to
register sources, triggers, sources or triggers, or nothing, as indicated in
the `Attribution-Reporting-Eligible` request header, which is a [structured
dictionary](https://www.rfc-editor.org/rfc/rfc8941.html#name-dictionaries).

The reporting origin may use the value of this header to determine which
registrations, if any, to include in its response. The browser will likewise
ignore invalid registrations:

1. `<a>` and `window.open` will have `navigation-source`.
2. Other APIs that automatically set `Attribution-Reporting-Eligible` (like
   `<img>`) will contain `event-source, trigger`.
3. Requests from JavaScript, e.g. `window.fetch`, can set this header using an
   option.
4. All other requests will not have the `Attribution-Reporting-Eligible`
   header. For those requests the browser will permit trigger registration
   only.

Note: the `Attribution-Reporting-Eligible` header is subject to the browser adding
"GREASE" parameters, to ensure that servers use a spec-compliant structured
header parser. See [here](https://wicg.github.io/attribution-reporting-api/#example-1c153954)
for an example.

### Data limits and noise

The `source_event_id` is limited to 64 bits of information to enable
uniquely identifying an ad click.

The trigger-side data must therefore be limited quite strictly, by limiting
the amount of data and by applying noise to the data. `navigation` sources will
be limited to only 3 bits of `trigger_data`, while `event` sources will be
limited to only 1 bit.

Noise will be applied to whether a source will be reported truthfully.
When an attribution source is registered, the browser will perform one of the
following steps given a probability `p`:
* With probability `1 - p`, the browser logs the source as normal
* With probability `p`, the browser chooses randomly among all the possible
output states of the API. This includes the choice of not reporting anything at
all, or potentially reporting multiple fake reports for the event.

Note that this scheme is an instantiation of k-randomized response, see
[Differential privacy](#differential-privacy).

Strawman: we can set `p` such that each source is protected with randomized
response that satisfies an epsilon value of 14. This would entail:
* `p = .24%` for `navigation` sources
* `p = .00025%` for `event` sources

Note that correcting for this noise addition is straightforward in most cases,
please see <TODO link to de-biasing advice/code snippet here>. Reports will be
updated to include `p` so that noise correction can work correctly in the event
that `p` changes over time, or if different browsers apply different
probabilities:

```jsonc
{
  "randomized_trigger_rate": 0.0024,
  ...
}
```

Note that these initial strawman parameters were chosen as a way to ease
adoption of the API without negatively impacting utility substantially. They are
subject to change in the future with additional feedback and do not necessarily
reflect a final set of parameters.

### Trigger attribution algorithm

When the browser receives an attribution trigger registration on a URL matching a
`destination` eTLD+1, it looks up all sources in storage that match
<reporting origin, `destination` eTLD+1> and picks the one with the greatest
`priority`. If multiple sources have the greatest `priority`, the
browser picks the one that was stored most recently.

The browser then schedules a report for the source that was picked by storing
{reporting origin, `destination` eTLD+1, `source_event_id`,
[decoded](#data-encoding) `trigger_data`, `priority`, `deduplication_key`} for
the source. Scheduled reports will be sent as detailed in [Sending scheduled
reports](#sending-scheduled-reports).

The browser will create reports for a source only if the trigger's
`deduplication_key` has not already been associated with a report for that source.

Each `navigation` source is allowed to schedule only a maximum of three reports,
while each `event` source is only allowed to schedule a maximum of one.

If a source has already scheduled the maximum number of reports when a new
report is being scheduled, the browser will compare the priority of the new
report with the priorities of the scheduled reports for that source. If the new
report has the lowest priority, it will be ignored. Otherwise, the browser will
delete the scheduled report with the lowest priority and schedule the new
report.

### Multiple sources for the same trigger (Multi-touch)

If multiple sources were registered and associated with a single attribution
trigger, the browser schedules reports for the one with the highest priority. If no priority is
specified, the browser effectively performs last-touch.

There are many possible alternatives to this, like providing a choice of
rules-based attribution models. However, it isn’t clear the benefits outweigh
the additional complexity. Additionally, models other than last-click
potentially leak more cross-site information if sources are clicked across
different sites.

### Sending Scheduled Reports

Reports for `event` sources will be sent after the source's `event_report_window`.

Reports for `navigation` sources may be reported earlier than the source's
`event_report_window`, at specified points in time relative to when the source event was
registered. See
[here](https://wicg.github.io/conversion-measurement-api/#delivery-time) for the
precise algorithm.

Note that the report may be sent at a later date if the browser was not running
when the window finished. In this case, reports will be sent on startup. The
browser may also decide to delay some of these reports for a short random time
on startup, so that they cannot be joined together easily by a given reporting
origin.

### Attribution Reports

To send a report, the browser will make a non-credentialed (i.e. without session
cookies) secure HTTP POST request to:

```
https://<reporting origin>/.well-known/attribution-reporting/report-event-attribution
```

The report data is included in the request body as a JSON object with the
following keys:

-   `attribution_destination`: the attribution destination set on the source

-   `source_event_id`: 64-bit event id set on the attribution source

-   `trigger_data`: Coarse data set in the attribution trigger registration

-   `report_id`: A UUID string for this report which can be used to prevent
    double counting

-   `source_type`: Either "navigation" or "event", indicates whether this source
    was associated with a navigation.

-   `randomized_trigger_rate`: Decimal number between 0 and 1 indicating how
    often noise is applied.

-   `scheduled_report_time`: The number of seconds since the Unix Epoch (1970-01-01T00:00:00Z, ignoring leap seconds) until the browser initially scheduled the report to be sent (to avoid noise around offline devices reporting late).


### Data Encoding

The source event id and trigger data should be specified in a way that is
amenable to the privacy assurances a browser wants to provide (i.e. the number
of distinct data states supported).

The input values will be 64-bit integers which the browser will interpret modulo
its maximum data value chosen by the browser. The browser will take the input
and performs the equivalent of:

```javascript
function getData(input, max_value) {
  return input % max_value;
}
```

The benefit of this method over using a fixed bit mask is that it allows
browsers to implement max\_values that aren’t multiples of 2. That is, browsers
can choose a "fractional" bit limit if they want to.

### Optional attribution filters

Source and trigger registration has additional optional functionality to both:
1. Selectively filter some triggers (effectively ignoring them)
1. Choose trigger data based on source event data

This can be done via simple extensions to the registration configuration.

Source registration:
```jsonc
{
  "source_event_id": "12345678",
  "destination": "https://toasters.example",
  "expiry": "604800000",
  "filter_data": {
    "conversion_subdomain": ["electronics.megastore", "electronics2.megastore"],
    "product": ["1234"]
    // Note that "source_type" will be automatically generated as
    // one of {"navigation", "event"}

    // Note that "_lookback_window" cannot be used as it would be
    // ignored. The reserved key is used to support lookback window.
  }
}
```

Trigger registration:
```jsonc
{
  ... // existing fields, such as `event_trigger_data`

  // Note that "not_filters", which filters with a negation, is also supported.
  "filters": {
    "conversion_subdomain": ["electronics.megastore"],
    // Not set on the source side, so this key is ignored
    "directory": ["/store/electronics]"
  }
}
```
If keys in the `filters` dictionary match keys in the `filter_data` dictionary
and the intersection of their values is empty, the trigger is ignored.

Example: Given a "conversion_subdomain" key present in both `filter_data` and
`filters` dictionaries. If the values of the `filters`'s "conversion_subdomain"
key do not include "electronics.megastore" or "electronics2.megastore", the
trigger gets ignored.

Note: A key which is present in one dictionary and not the other will not be
included in the matching logic (i.e. the trigger will be considered).

Note: A filter dictionary does not support nested dictionaries or lists. It is
only allowed to have a list of values with string type.

The `event_trigger_data` field can also be extended to do selective filtering
to set `trigger_data` based on `filter_data`:
```jsonc
// Filter by the source type to handle different bit limits.
{
  "event_trigger_data": [
    {
      "trigger_data": "2",
      // Note that "not_filters", which filters with a negation, is also supported.
      "filters": {"source_type": ["navigation"]}
    },
    {
      "trigger_data": "1",
      "filters": {"source_type": ["event"]}
    }
  ]
}
```

`filter_data` must be a dictionary. `filters` can be a
dictionary or a list of filter dictionaries. When a list is received, only one
dictionary has to match for the trigger to be considered.

```jsonc
{
  "event_trigger_data": [
    {
      "trigger_data": "2",
      "filters": [
        {"product": ["1234"], "conversion_subdomain": ["electronics.megastore"]},  // OR
        {"product": ["4321"], "conversion_subdomain": ["electronics4.megastore"]}
      ]
    },
  ]
}
```

If the filters do not match for any of the event triggers, no event-level report
will be created.

If the filters match for multiple event triggers, the first matching event
trigger is used.

#### Reserved keys

Keys prefixed with `_` are reserved: they cannot be used other than for
specified features, e.g., lookback window.

#### Lookback window

Lookback window is supported with an optional reserved keyword
`_lookback_window` which can be added to trigger's filters.

Unlike other filter keys whose values must be a list of strings, the
`_lookback_window` value must be a positive integer that represents a positive
duration in seconds.

When present on a filter (in `filters`), the duration since the source was
registered must be less than or equal to the parsed lookback window duration for
the filter to match, i.e., it must be inside the lookback window.

When present on a negated filter (in `not_filters`), the duration since the
source was registered must be greater than the parsed lookback window duration
for the filter to match, i.e., it must be outside the lookback window.

### Optional: Varying frequency and number of reports

Sources have two additional optional top-level fields:

```jsonc
{
  ...

  // Restricts the total number of event-level reports that this source can generate.
  // After this maximum is hit, the source is no longer capable of producing any new data.
  // Must be greater than or equal to 0 and less than or equal to 20.
  // Defaults to 3 for navigation sources and 1 for event sources.
  "max_event_level_reports": <int>,

  // Represents a series of time windows, starting at start_time.
  // Reports for this source will be delivered after the end of each window.
  // Time is encoded as seconds after source registration.
  // If omitted, will use the default windows.
  // It is an error to set both this field and the event_report_window field in
  // the same source.
  // Start time is inclusive, end times are exclusive.
  "event_report_windows": {

    // Optional. Defaults to 0.
    "start_time": <non-negative int>,

    // Required. Must be non-empty, strictly increasing, and greater than
    // start_time.
    "end_times": [<positive int>, ...]
  }
}
```

This may be used to:

* Vary the frequency of reports by specifying the number of reporting windows
* Vary the number of attributions per source registration
* Reduce the amount of total noise by decreasing the above parameters
* Configure reporting windows rather than using the defaults

#### Example

This example configuration supports optimizing for receiving reports at earlier reporting windows:

```jsonc
{
  ...
  "max_event_level_reports": 2,
  "event_report_windows": {
    "end_times": [7200, 43200, 86400] // 2 hours, 12 hours, 1 day in seconds
  }
}
```

### Optional: transitional debugging reports

The Attribution Reporting API is a new and fairly complex way to do attribution
measurement without third-party cookies. As such, we are open to introducing a
transitional mechanism to learn more information about attribution reports
_while third-party cookies are available_. This ensures that the API can be
fully understood during roll-out and help flush out any bugs (either in browser
or caller code), and more easily compare the performance to cookie-based
alternatives.

To ensure that this data (which could enable cross-site tracking) is only
available in a transitional phase while third-party cookies are available and
are already capable of user tracking, the browser will check (at both source
and trigger registration) for the presence of a special cookie
set by the reporting origin:
```http
Set-Cookie: ar_debug=1; SameSite=None; Secure; HttpOnly
```
If a cookie of this form is not present, debugging information will be ignored.

Note that in the context of proposals such as
[CHIPS](https://github.com/privacycg/CHIPS), the cookie must be unpartitioned in
order to allow debug keys to be registered.

Responses that register sources/triggers can also set the `ar_debug` cookie to
ensure that registration is eligible for debug reports. When using the `fetch`
APIs to do this, it will require ensuring the request is allowed to include
[`credentials`](https://developer.mozilla.org/en-US/docs/Web/API/fetch).

#### Attribution-success debugging reports

Source and trigger registrations will both accept a new field `debug_key`:
```jsonc
{
  ...
  "debug_key": "[64-bit unsigned integer]"
}
```

Reports will include up to two new parameters which pass any specified debug keys
from source and trigger events unaltered:
```jsonc
{
  // normal report fields...
  "source_debug_key": "[64-bit unsigned integer]",
  "trigger_debug_key": "[64-bit unsigned integer]"
}
```

If a report is created with both source and trigger debug keys, a duplicate debug
report will be sent immediately to a
`.well-known/attribution-reporting/debug/report-event-attribution`
endpoint. The debug reports will be identical to normal reports, including the
two debug key fields. Including these keys in both allows tying normal reports
to the separate stream of debug reports.

Note that event-level reports associated with false trigger events
will not have `trigger_debug_key`s. This allows developers to more
closely understand how noise is applied in the API.

#### Verbose debugging reports

We also introduce a debugging framework to allow developers to monitor certain
failures in the attribution registrations.

The browser will send non-credentialed secure HTTP `POST` requests to the
reporting endpoints, see [below](#reporting-endpoints). The report data is
included in the request body as a JSON list of objects, e.g.:

```jsonc
[{
  "type": "<report type>", // e.g. "source-destination-limit"
  "body": {
    "attribution_destination": "https://destination.example",
    "limit": "100", // the browser's limit
    "source_event_id": "<source event id in the source registration>",
    "source_site": "https://source.example"
  }
}]
```

Each object has:
 - `type`: a string that indicates the category of report.
 - `body`: the contents of the report as defined by the `type`.

These debugging reports will be sent immediately upon the error occurring
during attribution registrations outside a fenced frame tree.

##### Reporting endpoints

The reporting origins may opt in to receiving debugging reports by adding a new
`debug_reporting` dictionary field to the `Attribution-Reporting-Register-Source`
and `Attribution-Reporting-Register-Trigger` headers:
```jsonc
{
  ... // existing fields

  "debug_reporting": true // defaults to false if not present
}
```

The debugging reports will be sent to a new endpoint:
```
https://<reporting origin>/.well-known/attribution-reporting/debug/verbose
```

In order to receive verbose debug reports on trigger registrations, the special
`ar_debug` cookie needs to be present for both source and trigger registrations.

TODO: Consider adding support for the top-level site to opt in to receiving
debug reports without cross-site leak.

TODO: Consider supporting debug reports for attribution registrations inside a
fenced frame tree.

## Sample Usage

`publisher.example` wants to show ads on their site, so they contract out to
`ad-tech.example`. `ad-tech.example`'s script in the main document creates a
cross-origin iframe to host the third party advertisement for
`toasters.example`.

Within the iframe, `ad-tech-3p.example` code annotates their anchor tags to use
the `ad-tech.example` reporting origin, and sets the `attributionsrc` attribute
based on the ad that was served (e.g. some ad with id 123456).

```html
<iframe src="https://ad-tech-3p.example/show-some-ad"
        allow="attribution-reporting">
...
<a
  href="https://toasters.example/purchase"
  attributionsrc="https://ad-tech.example?adid=123456">
  click me!
</a>
...
</iframe>
```

A user clicks on the ad and this opens a window that lands on a URL to
`toasters.example/purchase`. In the background, the browser issues an HTTP
request to `https://ad-tech.example?adid=123456`. The ad-tech responds with a
`Attribution-Reporting-Register-Source` JSON header:
```jsonc
{
  "source_event_id": "12345678",
  "destination": "https://toasters.example",
  "expiry": "604800000"
}
```

2 days later, the user buys something on `toasters.example`. `toasters.example`
triggers attribution on the few different ad-tech companies it buys ads on,
including `ad-tech.example`, by adding conversion pixels:

```html
<img src="..." attributionsrc="https://ad-tech.example/trigger-attribution?model=toastmaster3000&price=$49.99&...">
```

`ad-tech.example` receives this request, and decides to trigger attribution on
`toasters.example`. They must compress all of the data into 3 bits, so
`ad-tech.example` chooses to encode the value as "2" (e.g. some bucketed version
of the purchase value). They respond to the request with an
`Attribution-Reporting-Register-Trigger` header:
```jsonc
{
  "event_trigger_data": [{
    "trigger_data": "2"
  }]
}
```

The browser sees this response, and schedules a report to be sent. The report is
associated with the 7-day deadline as the 2-day deadline has passed. Roughly 5
days later, `ad-tech.example` receives the following HTTP POST to
`https://ad-tech.example/.well-known/attribution-reporting/report-event-attribution`
with the following body:
```jsonc
{
  "attribution_destination": "https://toasters.example",
  "source_event_id": "12345678",
  "trigger_data": "2"
}
```

### Noisy fake conversion example

Assume the caller uses the same inputs as in the above example, however, the
[noise mechanism](#data-limits-and-noise) in the browser chooses to generate
completely fake data for the source event. This occurs with some probability
`p`.

To generate fake events, the browser considers all possible outputs for a given
source event:
* No reports at all
* One report with metadata "0" at the first reporting window
* One report with metadata "1" at the first reporting window and one report with
  metadata "3" at the second reporting window
* etc. etc. etc.

After enumerating all possible outputs of the API for a given source event, the
browser simply selects one of them at random uniformly. Any subsequent true
trigger events that would be attributed to the source event are completely
ignored.

In the above example, the browser could have chosen to generate three reports:
* One report with metadata "7", sent 2 days after the click
* One report with metadata "3", sent 7 days after the click
* One report with metadata "0", also sent 7 days after the click

## Storage limits

The browser may apply storage limits in order to prevent excessive resource
usage.

Strawman: There should be a limit of 1024 pending sources per source origin.

Strawman: There should be a limit of 1024 pending event-level reports per
destination site.

## Privacy Considerations

A primary privacy goal of the API is to make _linking identity_ between two
different top-level sites difficult. This happens when either a request or a
JavaScript environment has two user IDs from two different sites simultaneously.

Secondary goals of the API are to:
- give some level of _plausible deniability_ to cross-site data leakage
associated with source events.
- limit the raw amount of cross-site information a site can learn relative to a
source event

In this API, the 64-bit source ID can encode a user ID from the publisher’s top-
level site, but the low-entropy, noisy trigger data could only encode a small
part of a user ID from the advertiser’s top-level site. The source ID and the
trigger data are never exposed to a JavaScript environment together, and the
request that includes both of them is sent without credentials and at a
different time from either event, so the request adds little new information
linkable to these events. This allows us to limit the information gained by the
ad-tech relative to a source event.

Additionally, there is a small chance that all the output for a given source
event is completely fabricated by the browser, giving the user plausible
deniability whether subsequent trigger events actually occurred the way they
were reported.

### Trigger Data

Trigger data, e.g. advertiser-side data, is extremely important for critical use
cases like reporting the *purchase value* of a conversion. However, too much
advertiser-side data could be used to link advertiser identity with publisher
identity.

Mitigations against this are to provide only coarse information (only a few bits
at a time), and introduce some noise to the API output. Even sophisticated
attackers will therefore need to invoke the API multiple times (through multiple
clicks/views) to join identity between sites with high confidence.

Note that this noise still allows for aggregate measurement of bucket sizes with
an unbiased estimator (assuming rate-limits are not hit) See generic approaches
of dealing with [Randomized
response](https://en.wikipedia.org/wiki/Randomized_response) for a starting
point.

TODO: Update this script to account for the more complicated randomized response
approach.

### Reporting Delay

By bucketing reports within a small number reporting deadlines, it becomes
harder to associate a report with the identity of the user on the advertiser’s
site via timing side channels.

Reports within the same reporting window occur within an anonymity set with all
others during that time period. For example, if we didn’t bucket reports with a
delay (and instead sent them immediately after a trigger event), the reports
(which contain publisher IDs) could be easily joined up with the advertiser’s
first-party information via correlating timestamps.

Note that the delay windows / deadlines chosen represent a trade-off with
utility, since it becomes harder to properly assign credit to a click if the
time from click to conversion is not known. That is, time-to-conversion is an
important signal for proper attribution. Browsers should make sure that this
trade-off is concretely evaluated for both privacy and utility before deciding
on a delay.

### Reporting origin limits

If the advertiser is allowed to cycle through many possible reporting origins,
then the publisher and advertiser don’t necessarily have to agree a priori on
what origin to use, and which origin actually ends up getting used reveals some
extra information.

To prevent this kind of abuse, the browser should limit the number of reporting
origins per <source site, destination site> pair, counted per source
registration. This should be limited to 100 origins per 30 days.

Additionally, there should be a limit of 10 reporting origins per <source site,
destination site, 30 days>, counted for every attribution that is generated and a limit of 1 reporting origin per <source site, reporting site, 1 day> counted per source registration.

### Clearing Site Data

Attribution source data and attribution reports in browser storage should be
clearable using existing "clear browsing data" functionality offered by
browsers.

### Reporting cooldown / rate limits

To limit the amount of user identity leakage between a <source site,
destination site> pair, the browser should throttle the amount of total information
sent through this API in a given time period for a user. The browser should set
a maximum number of attributions per
<source site, destination site, reporting site, user> tuple per time period. If this
threshold is hit, the browser will stop scheduling reports the API for the
rest of the time period for attributions matching that tuple.

The longer the cooldown windows are, the harder it is to abuse the API and join
identity. Ideally attribution thresholds should be low enough to avoid leaking too
much information, with cooldown windows as long as practically possible.

Note that splitting these limits by the reporting site introduces a possible
leak when multiple sites collude with each other. However, the alternative
makes it very difficult to adopt the API if all reporting sites had to share a
budget.

Strawman rate limit: 100 attributions per {source site, destination site, reporting
site, 30 days}

### Less trigger-side data

Registering event attribution sources is not gated on a user interaction or top-
level navigation, allowing them to be registered more frequently and with
greater ease. For example, by restricting to 1 bit of data and 1 report per
event source, a `reportingorigin` would need to register many more sources in
order to link cross-site identity relative to the Click Through API.

This is further restricted by rate-limiting the usage of the API between two
sites, using [reporting
cooldowns](event_attribution_reporting_clicks.md#reporting-cooldown--rate-limits).
Due to the different characteristics between classes of sources, these cooldowns
should have independent limits on the number of reports of each type.

The number of reporting windows is another vector which can contain trigger-side
information. By restricting to a [single window](#single-reporting-window), a
`reportingorigin` does not receive any additional information on when in the
attribution window a source was triggered.

### Browsing history reconstruction

Reporting attribution allows the `reportingorigin` to learn whether a given user
on the source site visited (one of) the `destination` site(s) at all.

This threat is be mitigated in a number of ways:

#### Adding noise to whether a trigger is genuine

By adding noise to whether an attribute source gets
[triggered](#data-limits-and-noise), a reporting origin will not know with
absolute certainty whether a particular ad view led to a site visit. See
[Differential privacy](#differential-privacy).

#### Limiting the number of unique destinations covered by unexpired sources

To limit the breadth of `destination` sites that a reporting origin may be
trying to measure user visits on, the browser can limit the number `destination`
eTLD+1s represented by unexpired sources for a source-site.

The browser can place a limit on the number of a source site's unexpired source's
unique `destination` sites. When an attribution source is registered for an eTLD+1
that is not already in the unexpired sources and a source site is at its limit,
the browser will drop the new source.

The lower this value, the harder it is for a reporting origin to use the API to
try and measure user browsing activity not associated with ads being shown.
Browsers may choose parameters on the number of `destination`s to make their own
tradeoffs for privacy and utility.

Because this limit is per source site, it is possible for different reporting
origin on a site to push the other attribution sources out of the browser. See
the [denial of service](#denial-of-service) for more details. To prevent this
attack, the browser should maintain these limits per reporting site. This
effectively limits the number of unique sites covered by unexpired sources from
any one reporting site.

Strawman: 100 distinct destination sites per-{source site, reporting site},
applied to all unexpired sources regardless of type at source time.

#### Limiting the number of unique destinations per source site

To further reduce the possibility of a history reconstruction attack, the browser can also limit the number of `destination` eTLD+1s registered by source-sites.

Strawman: 200 distinct destination sites per-{source site, 1 minute}

Additionally, to prevent one origin from using up the budget in the limit above, the browser can also limit the number of `destination` eTLD+1s per reporting origin.

Strawman: 50 distinct destination sites per-{source site, reporting site, 1 minute}

### Differential privacy

A goal of this work is to create a framework that would support making
event-level measurement that satisfies local differential privacy. This follows
from our use of k-randomized response to generate noisy output for each source
event. For a given output space O with cardinality k, true value v in the output
space, and flip probability p, the k-randomized response algorithm:
- Flips a biased coin with heads probability p
- If heads, return a random value in O
- Otherwise return v

k-randomized response is an algorithm that is epsilon differentially private if
`p = k / (k + exp(epsilon) - 1)`. For low enough values of epsilon, a given
source’s true output should be well protected by the randomized response
mechanism.

Note that the number of all possible output states k in the above design is:
- 2925 for click sources. This results from a particular "stars and bars"
  counting method which derives `k = (num_reporting_windows * num_trigger_data +
  num_reports choose num_reports) = (3 * 8 + 3 choose 3)`. There are three reports per
  click (represented by stars) which can land in 3 * 8 + 1 bins. One bin corresponds
  to the no-report case, while the 24 others are the choice of one of 3 intermediate
  window and one of 8 metadata. To find the total number of ways to put 3 stars in of the bins, 
  the ["stars and bars" method](https://en.wikipedia.org/wiki/Stars_and_bars_(combinatorics)#Theorem_two_proof)
  represents the 3 * 8 + 1 bins by 3 * 8 bars and the 3 reports by stars, which makes a total 3 + 3 * 8 symbols.
  The total number of combinations is found by choosing the location of three stars out of 3 + 3 * 8 symbols,
  hence the formula.
- 3 for event-sources (no attribution, attribution with trigger data 1,
  attribution with trigger data 0). This also follows from `(1 * 2 + 1 choose 1)`.

Note that the scope of privacy in the current design is not user-level, but
rather source-level. This follows from the fact that noise is added
independently per source-event, and source events are not strictly rate-limited.
Exact noise parameters are subject to change with feedback. The primary goal
with this proposal as written is to ensure that the browser has the appropriate
infrastructure foundation to develop locally differentially private methods in
the future. Tightening the privacy scope will also be considered in future work.

Our plan is to adjust the level of noise added based on feedback during the
origin trial period, and our goal with this initial version is to create a
foundation for further exploration into formally private methods for
measurement.

### Speculative: Limits based on first party storage

Another mitigation on joining identity across publisher and advertiser sites is
to limit the number of reports for any given <publisher, advertiser> pair until
the advertiser clears their site data. This could occur via the
[Clear-Site-Data](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Clear-Site-Data)
header or by explicit user action.

To prevent linking across deletions, we might need to introduce new options to
the Clear-Site-Data header to only clear data after the page has unloaded.

## Security considerations

### Reporting origin control

Reports can only be generated if the same origin responds with headers that
register source events and trigger events. There is no way for an origin to
register events on behalf of another origin, which is an important restriction
to prevent fraudulent reports.

### Denial of service

Rate limits and other restrictions to the API can cause reports to no longer be
sent in some cases. It is important to consider all the cases where an origin
could utilize the API in some way to lock out other origins, and minimize that
risk if possible.

Currently, the only known limits in this proposal that could risk denial of
service are the [reporting origin limits](#reporting-origin-limits) and the [number of unique destinations per source site limits](#limiting-the-number-of-unique-destinations-per-source-site). These are an
explicit trade-off for privacy that should be monitored for abuse.

### Top site permission model

The Permissions Policy is used to globally enable or disable the API.
Additionally, network requests need fine grained permission in the form of
requiring an `attributionsrc` attribute.
