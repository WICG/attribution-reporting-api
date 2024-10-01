# Pre-Attribution Filtering: Attribution Scopes

_Note: This document describes possible new functionality in the Attribution Reporting API. This is a forwards and backwards compatible change to event-level and summary reports. While this new functionality is being developed, we still highly encourage testing the existing API functionalities to support core utility and compatibility needs._

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

**Table of Contents**

- [Goals](#goals)
- [Pre-Attribution Filtering](#pre-attribution-filtering)
  - [API changes](#api-changes)
  - [Updating attribution scope values](#updating-attribution-scope-values)
  - [Deletion logic](#deletion-logic)
- [Attribution scope example](#attribution-scope-examples)
- [Alternatives Considered](#alternatives-considered)
- [Privacy Considerations](#privacy-considerations)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

<br>
The current attribution logic in the Attribution Reporting API may not be ideal for use-cases where an API caller needs finer-grained control over the attribution granularity (e.g. campaign, product, conversion ID, etc.) before a source is chosen for attribution. Currently available features such as top-level filters are not sufficient for this use-case because they happen after a source has been selected (i.e. after destination matching), which results in either no attribution occurring or incorrect attribution depending on the top-level filters that are set. We can support this use-case by allowing registrations to specify predefined attribution scopes that will be considered for filtering *before* attributing a source, in order to more efficiently extract utility from the API. 

## Goals

In general, the approach here is to allow API callers to specify a list of strings for sources and triggers during registration that can be used for filtering before attribution takes place:

* Allow finer-grained filtering before attribution, trading off additional filtering with source configuration flexibility

## Pre-Attribution Filtering

### API changes

The following optional parameter will be added to the JSON in `Attribution-Reporting-Register-Source` during source registration: `attribution_scopes`, which contains required parameters `values`, `limit`, and an optional parameter `max_event_states`:

```jsonc
{
  ..., // existing fields

  // Optional
  "attribution_scopes": {
    // Required
    // Represents the total number of distinct scopes allowed per destination for the source reporting origin.
    // This is used to calculate the information gain for event-level reports.
    // Attribution scope limit values must be positive integers.
    "limit": <int>,
  
    // Required
    // Represents a list of attribution scopes for a particular source.
    // This is used to define the values that will be used to perform pre-attribution filtering.
    // Attribution scope values must be strings. Each string has a maximum length of 50.
    // The maximum length of the attribution scopes list is the minimum of the limit value and 20.
    "values": <list of strings>,
  
    // Optional
    // Represents the maximum number of event states that an API caller plans to use across all
    // subsequent event-source registrations.
    // Example: default event source for event-level reports supports 1 attribution report, 1 reporting window,
    // and 1 bit of trigger data for a total of 3 event states.
    // This is used to calculate the information gain for event-level reports.
    // Max event states must be positive integers.
    // Defaults to 3 if omitted.
    // The flexible event-level script linked in the Privacy Considerations section below can be used to
    // calculate number of states based on a configuration.
    "max_event_states": <int>
  }
}
```

The following optional parameter will be added to the JSON in  `Attribution-Reporting-Register-Trigger` during trigger registration: `attribution_scopes`:

```jsonc
{
  ..., // existing fields

  // Optional
  // Represents a list of attribution scopes for a particular trigger.
  // Triggers will only match sources whose attribution_scopes contains at least one of the trigger's
  // attribution_scopes, if specified.
  // Attribution scope values must be strings.
  // Defaults to the empty list if omitted.
  "attribution_scopes": <list of strings>,
}
```

Only sources whose `attribution_scopes/values` contains at least one of the trigger’s `attribution_scopes` will be considered for attribution. Note that this filtering takes place before attributing a trigger to a particular source.

If there are multiple sources whose `attribution_scopes/values` contains at least one of the trigger’s `attribution_scopes`, then attribution will take place among the sources within the particular `attribution_scopes` according to current [Attribution Reporting API logic](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#trigger-attribution-algorithm).

If the trigger registration's `attribution_scopes` is empty, then all sources are considered for attribution.

Once a `attribution scopes/limit` is set, the last K values (where K = `attribution scopes/limit`) of `attribution_scopes/values` will be considered the final set of attribution scopes values and any source with additional values will be deleted. Additionally, when a new source uses the `attribution_scopes` feature, then all previous source registrations that do no use the feature will be deleted. Similarly, if a new source does not use the `attribution_scopes` feature, then all previous pending sources registrations will be treated as if they have empty `attribution_scopes` fields.

For sources that use the `attribution_scopes` feature, if the source registration is specified with a configuration that has a higher number of event states than the most recent `max_event_states` for the same reporting origin, then the source will be rejected and the registration will fail. If the `max_event_states` field is changed in a future source registration, then all other previous pending source registrations that use the `attribution_scopes` feature with a different `max_event_states` will be ignored in subsequent attribution report generation flows, but will still count towards rate limits. 

### Updating attribution scope values

An API caller may want to update the value of `attribution scopes/limit` for certain registrations or at a certain time. For example, when an advertiser starts a new campaign the API caller may want to increase the value of `attribution scopes/limit` to account for this new campaign.

The `attribution scopes/limit` value can be updated during source registration at any time. However, any pending sources (previously registered) that have been specified with an `attribution scopes/limit` less than the current source registration’s `attribution scopes/limit` will be deleted.

### Deletion logic

If the current trigger passes the top-level filter check during the attribution process, then all other eligible sources considered for attribution (across all `attribution_scopes` and including eligible sources that do not use the `attribution_scopes` feature) will be deleted. This deletion logic is necessary in order to prevent an attack vector where an API caller could abuse the API to receive multiple reports for a single user action, which would be possible if the API only deleted the specific source that gets attributed and none of the other eligible sources.

## Attribution Scope Examples

### Example 1: distinct attribution scopes comparison with attribution filters

This example shows an API caller that manages 2 ads on the same destination site (scheme + eTLD+1).
If the API caller uses [attribution filters](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#optional-attribution-filters)
to select the ads:

```mermaid
timeline
  section source.example
    shoes ad: source 1 (filter_data "shoes") at t=0
    shirts ad: source 2 (filter_data "shirts") at t=1
  section trigger.example
    shoes page: trigger (filters "shoes") at t=2 but not attributed
```

The API caller [registers an attribution source](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#registering-attribution-sources)
when the user clicks a shoes ad at t=0.

```jsonc
// source registration 1 (Attribution-Reporting-Register-Source) for shoes ad at t=0
{
  "destination": "https://trigger.example",
  "filter_data": {
    "ad_id": ["shoes"]
  }
}
```

The API caller [registers an attribution source](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#registering-attribution-sources)
when the user clicks a shirts ad at t=1.

```jsonc
// source registration 2 (Attribution-Reporting-Register-Source) for shirts ad at t=1
{
  "destination": "https://trigger.example",
  "filter_data": {
    "ad_id": ["shirts"]
  }
}
```

The API caller [registers an attribution trigger](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#triggering-attribution)
when the user purchases a pair of shoes at t=2.

```jsonc
// trigger registration (Attribution-Reporting-Register-Trigger) for shoes purchase at t=2
{
  "event_trigger_data": [{
    "trigger_data": "0"
  }],
  "filters": {
    "ad_id": ["shoes"]
  }
}
```

In this example both source registrations would be eligible for attribution
based on their reporting origin and destination site, but the API would choose
the second source registration because it was the most recent source registration.
However, because the top-level filters (i.e. `filter_data` of the second source
registration and the `filters` of the trigger) do not match, the API caller would
not receive an attribution report.

However, if the API caller uses `attribution_scopes`:

```mermaid
timeline
  section source.example
    shoes ad: source 1 (scopes "shoes") at t=0
    shirts ad: source 2 (scopes "shirts") at t=1
  section trigger.example
    shoes page: trigger (scopes "shoes") at t=2 and attributed to source 1
```

```jsonc
// source registration 1 (Attribution-Reporting-Register-Source) for shoes ad ad t=0
{
  "destination": "https://trigger.example",
  "attribution_scopes": {
    "limit": 2,
    "values": ["shoes"],
  }
}
```

```jsonc
// source registration 2 (Attribution-Reporting-Register-Source) for shirts ad at t=1
{
  "destination": "https://trigger.example",
  "attribution_scopes": {
    "limit": 2,
    "values": ["shirts"],
  }
}
```

```jsonc
// trigger registration (Attribution-Reporting-Register-Trigger) for shoes purchase at t=2
{
  "event_trigger_data": [{
    "trigger_data": "0"
  }],
  "attribution_scopes": ["shoes"]
}
```

The API starts by checking to see if there are any sources that have `attribution_scopes/values` that are not disjoint with the trigger's `attribution_scopes`. The API will then use that set of sources to perform the rest of the attribution process. In this example, the API would start by selecting the first source registration since it is the only source that has a non-disjoint set with the trigger's `attribution_scopes`.  After this has been checked the API will continue with the rest of the attribution checks.
The API caller would receive an attribution report attributing the trigger registration to the first source registration.

### Example 2: multiple attribution scope values per source and trigger

This example shows an API caller that manages an ad banner that contains multiple images for different campaigns (for example: Phones and TVs). In this example the API caller needs sources and triggers that span across multiple `attribution_scopes` at once:

```jsonc
// source registration 1 for campaign promoting products 1, 2, and 3 at t=0
{
  ..., // existing fields
  "attribution_scopes": {
    "limit": 4,
    "values": ["product1", "product2", "product3"],
    "max_event_states": 3
  }
}
```

```jsonc
// source registration 2 for campaign promoting only product 2 at t=1
{
  ..., // existing fields
  "attribution_scopes": {
    "limit": 4,
    "values": ["product2"],
    "max_event_states": 3
  }
}
```

```jsonc
// source registration 3 for campaign promoting only product 4 at t=2
{
  ..., // existing fields
  "attribution_scopes": {
    "limit": 4,
    "values": ["product4"],
    "max_event_states": 3
  }
}
```

The user then converts at a later time on the destination site and makes a purchase related to product 2 and 3:

```jsonc
// trigger registration 1 for product related to products 2 and 3 at t=3
{
  ..., // existing fields
  "attribution_scopes": ["product2", "product3"]
}
```

In this example the API will start by finding any sources that have an `attribution_scopes/values` that matches at least one of the trigger registration `attribution_scopes`. In this example that would be source registration 1 and 2. The API will then perform attribution between these two sources. In this example source registration 2 will win the attribution process because it was the most recent source registration. The API caller would receive an attribution report attributing the trigger registration to source registration 2.

## Alternatives Considered

One alternative that was considered was instead of using `attribution_scopes` the API would perform attribution matching on a finer granularity than site (e.g. origin or path). This approach would allow the rest of the API logic to continue working as it does currently. However, the `attribution_scopes` proposal gives users additional flexibility in case their URL structures do not match their logical scope structures. Matching on finer granularity than site may open additional potential attack vectors and would require additional rate limits.

## Privacy Considerations

### Impact on flexible event-level reporting

The use of `attribution_scopes` will have some impact on the amount of utility that can be extracted from the Flexible Event-Level reporting proposal. Flexible event-level configurations that do not use `attribution_scopes` will continue to be verified against an [information gain limit](https://github.com/WICG/attribution-reporting-api/blob/main/params/chromium-params.md).


Flexible event-level configurations that use `attribution_scopes` will be verified against two separate limits:
  * The base flexible event-level configuration will continue to be verified against the current information gain limit.
  * The second check will take into account the `attribution scopes/limit` and `attribution scopes/max_event_states` values, in addition to the flexible event-level configuration, as part of the information gain calculation and be verified against a separate [information gain limit](https://github.com/WICG/attribution-reporting-api/blob/main/params/chromium-params.md).

TODO: Update script to allow for testing different configurations that include `attribution scopes/limit`

Note that the `attribution scopes/limit` does not have any impact on the privacy mechanisms used in Aggregatable Reports.

### Additional Privacy Limits
It is possible for an adversary to register multiple navigation sources during source registration, and use these multiple sources, each with a different attribution scopes value, to gain additional information about a user based on which attribution scope is chosen. To prevent this abuse the number of unique attribution scope sets per reporting origin per navigation needs to be limited.

TODO: update [parameters](https://github.com/WICG/attribution-reporting-api/blob/main/params/chromium-params.md) table with new rate limit

Strawman: 1 unique attribution scope set per reporting origin per navigation
