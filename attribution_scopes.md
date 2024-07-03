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

The following optional parameters will be added to the JSON in `Attribution-Reporting-Register-Source` during source registration: `attribution_scopes`, `attribution_scope_limit`, and `max_event_states`:

```jsonc
{
  ..., // existing fields

  // Optional
  // Represents the total number of distinct scopes allowed per destination for the source reporting origin.
  // This is used to calculate the information gain for event-level reports.
  // Attribution scope limit values must be positive integers.  
  // Defaults to null if omitted.
  "attribution_scope_limit": <int>,

  // Optional
  // Represents a list of attribution scopes for a particular source.
  // This is used to define the values that will be used to perform pre-attribution filtering.
  // Attribution scope values must be strings. Each string has a maximum length of 50.
  // The maximum length of the attribution_scopes list is the minimum of the attribution_scope_limit value and 20.
  // Defaults to the empty list if omitted.
  "attribution_scopes": <list of strings>,

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

Only sources whose `attribution_scopes` contains at least one of the trigger’s `attribution_scopes` will be considered for attribution. Note that this filtering takes place before attributing a trigger to a particular source.

If there are multiple sources whose `attribution_scopes` contains at least one of the trigger’s `attribution_scopes`, then attribution will take place among the sources within the particular `attribution_scopes` according to current [Attribution Reporting API logic](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#trigger-attribution-algorithm).

If the trigger registration's `attribution_scopes` is empty, then all sources are considered for attribution.

Once an `attribution_scope_limit` is set, the last K values (where K = `attribution_scope_limit`) of `attribution_scopes` will be considered the final set of `attribution_scopes` values and any source with additional `attribution_scopes` values will be treated as if the attribution scopes were empty.

If a source registration is specified with a configuration that has a higher number of event states than the most recent `max_event_states` for the same reporting origin, then the source will be rejected and the registration will fail. Additionally, if the `max_event_states` field is changed in a future source registration, then all other previous pending source registrations with a different `max_event_states` will be ignored in subsequent attribution report generation flows, but will still count towards rate limits. 

### Updating attribution scope values

An API caller may want to update the value of `attribution_scope_limit` for certain registrations or at a certain time. For example, when an advertiser starts a new campaign the API caller may want to increase the value of `attribution_scope_limit` to account for this new campaign.

The `attribution_scope_limit` value can be updated during source registration at any time. However, any pending sources (previously registered) that have been specified with an `attribution_scope_limit` less than the current source registration’s `attribution_scope_limit` will be deleted.

### Deletion logic

If the current trigger passes the top-level filter check during the attribution process, then all other eligible sources considered for attribution (across all `attribution_scopes`) will be deleted.

## Attribution Scope Examples

### Example 1: distinct attribution scopes

This example shows an API caller that manages 3 advertisers that all sell products on the same destination site (scheme + eTLD+1). In this example the API caller uses an `attribution_scope_limit` of 3 and tracks each advertiser with a distinct `attribution_scopes` value. Additionally, the user browsing the web sees 4 different ads from these advertisers and each one has a source registration associated:

```jsonc
// source registration 1 for advertiser1 at t=0
{
  ..., // existing fields
  "attribution_scope_limit": 3,
  "attribution_scopes": ["advertiser1"],
  "max_event_states": 3
}
```

```jsonc
// source registration 2 for advertiser1 at t=1
{
  ..., // existing fields
  "attribution_scope_limit": 3,
  "attribution_scopes": ["advertiser1"],
  "max_event_states": 3
}
```

```jsonc
// source registration 3 for advertiser2 at t=2
{
  ..., // existing fields
  "attribution_scope_limit": 3,
  "attribution_scopes": ["advertiser2"],
  "max_event_states": 3
}
```
```jsonc
// source registration 4 for advertiser3 at t=3
{
  ..., // existing fields
  "attribution_scope_limit": 3,
  "attribution_scopes": ["advertiser3"],
  "max_num_event_states": 3
}
```

The user then converts at a later time on the destination site by purchasing a product associated with advertiser1:

```jsonc
// trigger registration 1 for advertiser1 at t=4
{
  ..., // existing fields
  "attribution_scopes": ["advertiser1"]
}
```

The API automatically performs attribution between any sources that have `attribution_scopes` that are not disjoint with the trigger `attribution_scopes`. Any sources that do not have an `attribution_scopes` that matches at least one of the trigger registration `attribution_scopes` are deleted (assuming the source that is chosen passes the top-level filter check; if it does not then no sources are deleted). In this example, the API caller would receive an attribution report attributing the trigger registration to advertiser1’s second source registration.

### Example 2: multiple attribution scope values per source and trigger

This example shows an API caller that manages an ad banner that contains multiple images for different campaigns (for example: Phones and TVs). In this example the API caller needs sources and triggers that span across multiple `attribution_scopes` at once:

```jsonc
// source registration 1 for campaign promoting products 1, 2, and 3 at t=0
{
  ..., // existing fields
  "attribution_scope_limit": 4,
  "attribution_scopes": ["product1", "product2", "product3"],
  "max_event_states": 3
}
```

```jsonc
// source registration 2 for campaign promoting only product 2 at t=1
{
  ..., // existing fields
  "attribution_scope_limit": 4,
  "attribution_scopes": ["product2"],
  "max_event_states": 3
}
```

```jsonc
// source registration 3 for campaign promoting only product 4 at t=2
{
  ..., // existing fields
  "attribution_scope_limit": 4,
  "attribution_scopes": ["product4"],
  "max_event_states": 3
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

In this example the API will start by finding any sources that have an `attribution_scopes` that matches at least one of the trigger registration `attribution_scopes`. In this example that would be source registration 1 and 2. The API will then perform attribution between these two sources. In this example source registration 2 will win the attribution process because it was the most recent source registration. The API caller would receive an attribution report attributing the trigger registration to source registration 2.

## Alternatives Considered

One alternative that was considered was instead of using `attribution_scopes` the API would perform attribution matching on a finer granularity than site (e.g. origin or path). This approach would allow the rest of the API logic to continue working as it does currently. However, the `attribution_scopes` proposal gives users additional flexibility in case their URL structures do not match their logical scope structures. Additionally, matching on finer granularity than site may open additional potential attack vectors and would require additional rate limits.

## Privacy Considerations

### Impact on flexible event-level reporting

The use of `attribution_scopes` will have some impact on the amount of utility that can be extracted from the [Flexible Event-Level](https://github.com/WICG/attribution-reporting-api/blob/main/flexible_event_config.md) reporting proposal. In order to preserve the current privacy levels, the information gain limit that is used to verify acceptable flexible event-level configurations will now include the `attribution_scope_limit` and `max_event_states` values as part of the calculation. In other words, the additional information gain from the `attribution_scope_limit` and `max_event_states` that are chosen will be subtracted from the flexible event-level information gain limit and then used to identify whether the flexible event-level configuration is within the current privacy levels.

TODO: Update [script](https://github.com/WICG/attribution-reporting-api/tree/main/ts) to allow for testing different configurations that include `attribution_scope_limit`

Note that the `attribution_scope_limit` does not have any impact on the privacy mechanisms used in Aggregatable Reports.

### Additional Privacy Limits

It is possible for an adversary to register multiple navigation sources during source registration, and use these multiple sources, each with a different attribution scopes value, to gain additional information about a user based on which attribution scope is chosen. To prevent this abuse the number of unique attribution scope sets per reporting origin per navigation needs to be limited.

TODO: update [parameters](https://github.com/WICG/attribution-reporting-api/blob/main/params/chromium-params.md) table with new rate limit

Strawman: 1 unique attribution scope set per reporting origin per navigation
