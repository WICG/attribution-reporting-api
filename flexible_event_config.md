# Flexible event-level configurations

_Note: This document describes possible new functionality in the Attribution Reporting API’s event-level reports. This is a forwards and backwards compatible change to event-level reports. While this new functionality is being developed, we still highly encourage testing the existing API functionalities to support core utility and compatibility needs._

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

- [Goals](#goals)
- [Phase 2: Full Flexible Event-Level](#phase-2-full-flexible-event-level)
  - [API changes](#api-changes)
  - [Trigger prioritization](#trigger-prioritization)
  - [Trigger-data modulus matching example](#trigger-data-modulus-matching-example)
- [Configurations that are equivalent to the current version](#configurations-that-are-equivalent-to-the-current-version)
  - [Equivalent event sources](#equivalent-event-sources)
  - [Equivalent navigation sources](#equivalent-navigation-sources)
  - [Custom configurations: Examples](#custom-configurations-examples)
    - [Reporting trigger value buckets](#reporting-trigger-value-buckets)
  - [Reporting trigger counts](#reporting-trigger-counts)
    - [Binary with more frequent reporting](#binary-with-more-frequent-reporting)
  - [Varying `trigger_specs` from source to source](#varying-trigger_specs-from-source-to-source)
- [Privacy considerations](#privacy-considerations)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

The default configuration for event and navigation sources may not be ideal for all use-cases. We can optionally support extended configurations that allow for callers to specify precisely the information they want out of reports, in order to more efficiently extract utility out of the privacy mechanism. The most efficient configuration will differ from use-case to use-case and will depend on a) the parameters of our privacy mechanism and b) the noise level that can be tolerated by the use-case.

This proposal is broken into two separate feature sets:
* __Phase 1: Lite flexible event-level configuration__
  * This lite version provides a subset of the full feature and can be used independently of Phase 2.
  * Implemented [as described in the primary explainer](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#optional-varying-frequency-and-number-of-reports).
* __Phase 2: Full version of flexible event-level configuration__

Phase 2 (Full flexible event-level) could be used to do all of the capabilities in Phase 1 and:
* Vary the trigger data cardinality in a report
* Reduce the amount of total noise by decreasing the trigger data cardinality

## Goals

In general, the approach here is to more flexibly encode the output of the API for event-level reports:

* Allow tuning the output space for a particular source, trading off richness of output (e.g. cardinality of `trigger_data`, number of reporting windows, etc.) with noise levels (See [issue #99](https://github.com/WICG/attribution-reporting-api/issues/99), [issue #734](https://github.com/WICG/attribution-reporting-api/issues/734), and [issue #733](https://github.com/WICG/attribution-reporting-api/issues/733))
* Allow for value-based reporting (via bucketization) in addition to count-based reporting ([issue #55](https://github.com/WICG/attribution-reporting-api/issues/55))
* Allow for choosing flexible reporting windows ([issue #46](https://github.com/WICG/attribution-reporting-api/issues/46) and [issue #736](https://github.com/WICG/attribution-reporting-api/issues/736))
* Allow for setting the possible output space for a source based on a _prior probability distribution_ the ad tech has about the types of trigger that are possible, taking advantage of recent research into label differential privacy for [binary classification](https://arxiv.org/abs/2102.06062) and [regression problems](https://arxiv.org/abs/2212.06074).

## Phase 2: Full Flexible Event-Level

### API changes

In addition to the parameters that were added in Phase 1, we will add one additional optional parameter to the JSON in `Attribution-Reporting-Register-Source`: `trigger_specs`

```jsonc
{
  // A trigger spec is a set of matching criteria, along with a scheme to
  // generate bucketized output based on accumulated values across multiple
  // triggers within the specified event_report_window.
  // There will be a limit on the number of specs possible to define for a source.
  // MAX_UINT32 is 2^32 - 1 (4294967295).
  "trigger_specs": [{
    // This spec will only apply to registrations that set one of the given
    // trigger data values (integers in the range [0, MAX_UINT32]) in the list.
    // trigger_data will still appear in the event-level report.
    // Entries in trigger_data must be distinct, and the sets of all trigger_data fields within trigger_specs must be disjoint.
    "trigger_data": [<int>, ...],

    // Represents a series of time windows, starting at start_time offset from the source registration time.
    // Reports for this spec will be delivered after the end of each window.
    // Time is encoded as seconds after source registration.
    // end_times must consist of strictly increasing positive integers.
    // If event_report_windows
    // is omitted, will use the "event_report_window" or "event_report_windows" field specified at the global level for the
    // source (or the default windows if none are specified).
    // Start time is inclusive, End time is exclusive.
    "event_report_windows": {
      "start_time": <int>, // optional, defaults to 0
      "end_times": [<int>, ...],
    }

    // Represents an operator that summarizes the triggers within a window
    // count: number of triggers attributed within a window
    // value_sum: sum of the value of triggers within a window
    // The summary is reported as an index into a bucketization scheme.
    // Defaults to "count"
    "summary_window_operator": <one of "count" or "value_sum">,

    // Represents a bucketization of the integers from [0, MAX_UINT32], encoded as
    // a list of integers where new buckets begin (excluding 0 which is
    // implicitly included).
    // It must consist of strictly increasing positive integers.
    //
    // e.g. [5, 10, 100] encodes the following ranges:
    // [[0, 4], [5, 9], [10, 99], [100, MAX_UINT32]]
    //
    // At the end of each reporting window, triggers will be summarized into an
    // integer which slots into one of these ranges. Reports will be sent for
    // every new range boundary that is crossed. Reports will never be sent for
    // the range that includes 0, as every source is initialized in this range.
    //
    // If omitted, then represents a trivial mapping [1, 2, ... , MAX_UINT32].
    "summary_buckets": [<bucket start>, ...]
  }, {
    // Next trigger_spec
  }, ...],

  // Specifies how the 64-bit unsigned trigger_data from the trigger is matched
  // against the source's trigger_specs trigger_data, which is 32-bit. Defaults
  // to "modulus".
  //
  // If "exact", the trigger_data must exactly match a value contained in the
  // source's trigger_specs; if there is no such match, no event-level
  // attribution takes place.
  //
  // If "modulus", the set of all trigger_data values across all trigger_specs
  // for the source must be a contiguous sequence of integers starting at 0.
  // The trigger's trigger_data is taken modulus the cardinality of this
  // sequence and then matched against the trigger specs. See below for an
  // example. It is an error to use "modulus" if the trigger specs do not
  // contain such a sequence.
  "trigger_data_matching": <one of "exact" or "modulus">,

  // See description in phase 1.
  "max_event_level_reports": <int>,

  // See description in phase 1.
  "event_report_windows": {
    "start_time": <int>,
    "end_times": [<int>, ...]
  }
}
```

This configuration fully specifies the output space of the event-level reports, per source registration. For every trigger spec, we fully specify:
* A set of matching criteria:
  * Which specific trigger data this spec applies to. This source is eligible to be matched only with triggers that have one of the specified `trigger_data` values in the `trigger_specs` according to the `trigger_data_matching` field. In other words, if the trigger would have matched this source but its `trigger_data` is not one of the values in the source's configuration, the trigger is ignored.
  * When a specific trigger matches this spec (via `event_report_windows`).
Note that the trigger could still be matched with a source for aggregatable reports despite failing the above two match criteria.
* A specific algorithm for summarizing and bucketizing all the triggers within an attribution window. This allows triggers to specify a `value` parameter that gets summed up for a particular spec, but reported as a bucketized value

Note that these matching criteria take place _after_ attributing a trigger to a particular source i.e. after step 5 [here](https://wicg.github.io/attribution-reporting-api/#trigger-attribution). If `trigger_specs` are specified for a source and no matching spec is found after attribution, the trigger will be ignored.

Triggers will also support adding an optional `value` parameter in the dictionaries within `event_trigger_data`.

```jsonc
{
  "event_trigger_data": [
    {
      "trigger_data": "2",
      "value": 100,  // Defaults to 1
      "filters": ...
    },
    ...
  ]
}
```

Every trigger registration will match with at most one trigger spec and update its associated summary value. At a high level, at trigger time we will:

* Apply global attribution filters
* For every trigger spec:
  * Evaluate the `event_trigger_data` on the spec to find a match, using the spec’s `event_reporting_window`
    * The top-level `event_reporting_windows` will act as a default value in case any trigger spec is the missing `event_report_windows` sub-field
* The first matched spec is chosen for attribution, and we increment its summary value by `value` if the spec's `summary_window_operator` is `value_sum`, or by `1` if it is `count`, saturating in both cases at `MAX_UINT32`.

When the `event_report_window` for a spec completes, we will map its summary value to a bucket, and send an event-level report for every increment in the summary bucket caused by attributed trigger values. Reports will come with one extra field `trigger_summary_bucket`.

```jsonc
{
  ...
  "trigger_summary_bucket": [<bucket start>, <bucket end>]
}
```
### Trigger prioritization

Given that triggering attribution can affect a source's state without producing a report, we will need a new algorithm for doing trigger prioritization. Here is a sketch of how it could work:

1. For every source, maintain a list of triggers, sorted in order of priority (descending), then trigger time (ascending)
2. At the end of any report window (across all of a source's specs, breaking ties arbitrarily):
    1. Iterate through the source's triggers in order, "applying" them to generate a list of "speculative" reports. Stop whenever privacy limits are hit.
    2. Send all of the speculative reports that are scheduled to be emitted in the current window
    3. Update the source's total value per trigger data, and total # of event-level reports based on all of the triggers that were successfully applied in the current window.
    4. Delete all of the speculative reports that are not scheduled to be emitted in this window.
    5. Delete all of the triggers associated with the current spec and window from the source's trigger list

### Trigger-data modulus matching example

Given a source with the following registration:

```jsonc
{
  "trigger_data_matching": "modulus",
  "trigger_specs": [
    // Spec A
    {
      "trigger_data": [0, 3, 5],
      ...
    },
    // Spec B
    {
      "trigger_data": [1, 2],
      ...
    },
    // Spec C
    {
      "trigger_data": [4],
      ...
    },
  ]
}
```

The trigger-data cardinality is 6, so all triggers' `trigger_data` will be taken
modulus 6 before determining the matching `trigger_spec`:

- `{"trigger_data": "0"}` will match Spec A because `0 % 6 = 0`
- `{"trigger_data": "1"}` will match Spec B because `1 % 6 = 1`
- `{"trigger_data": "2"}` will match Spec B because `2 % 6 = 2`
- `{"trigger_data": "3"}` will match Spec A because `3 % 6 = 3`
- `{"trigger_data": "4"}` will match Spec C because `4 % 6 = 4`
- `{"trigger_data": "5"}` will match Spec A because `5 % 6 = 5`
- `{"trigger_data": "6"}` will match Spec A because `6 % 6 = 0`
- `{"trigger_data": "7"}` will match Spec B because `7 % 6 = 1`
- `{"trigger_data": "8"}` will match Spec B because `8 % 6 = 2`
- `{"trigger_data": "9"}` will match Spec A because `9 % 6 = 3`
- `{"trigger_data": "10"}` will match Spec C because `10 % 6 = 4`
- `{"trigger_data": "11"}` will match Spec A because `11 % 6 = 5`
- ...

## Configurations that are equivalent to the current version

The following are equivalent configurations for the API's current event and navigation sources, respectively. Especially for navigation sources, this illustrates why the noise levels are so high relative to event sources to maintain the same epsilon values: navigation sources have a much larger output space.

It is possible that there are multiple configurations that are equivalent, given that some parameters can be set as default or omitted.

### Equivalent event sources

```jsonc
// Note: most of the fields here are not required to be explicitly listed.
// Here we list them explicitly just for clarity.
{
  "trigger_data_matching": "modulus",
  "trigger_specs": [{
    "trigger_data": [0, 1],
    "event_report_windows": {
      "end_times": [<30 days>]
    },
    "summary_window_operator": "count",
    "summary_buckets": [1]
  }],
  "max_event_level_reports": 1,
  ...
  "expiry": <30 days> // expiry must be greater than or equal to the last element of the end_times
}
```

### Equivalent navigation sources

```jsonc
// Note: most of the fields here are not required to be explicitly listed.
// Here we list them explicitly just for clarity.
{
  "trigger_data_matching": "modulus",
  "trigger_specs": [{
    "trigger_data": [0, 1, 2, 3, 4, 5, 6, 7],
    "event_report_windows": {
      "end_times": [<2 days>, <7 days>, <30 days>]
    },
    "summary_window_operator": "count",
    "summary_buckets": [1, 2, 3]
  }],
  "max_event_level_reports": 3,
  ...
  "expiry": <30 days> // expiry must be greater than or equal to the last element of the end_times
}
```

### Custom configurations: Examples

Below are some additional configurations outside the defaults. In all of the below examples, the user (developer) is either trading off
* reducing some dimension of the default configuration (#triggers, trigger data cardinality, #windows) for increasing another one to preserve the noise level
* reducing some dimension of the default configuration (#triggers, trigger data cardinality, #windows) for reduced noise level

#### Reporting trigger value buckets

This example configuration supports a developer who wants to optimize for value data for only one reporting window (e.g. 7 days), trading fewer reporting windows for less noise. In this example any trigger that sets `trigger_data` to a value other than 0 is ineligible for event-level attribution.

```jsonc
{
  "trigger_data_matching": "exact",
  "trigger_specs": [{
    "trigger_data": [0],
    "event_report_windows": {
      "end_times": [604800, 1209600] // 7 days, 14 days represented in seconds
    },
    "summary_window_operator": "value_sum",
    "summary_buckets": [5, 10, 100]
  }],
}
```

Triggers could be registered with the value field set, which are summed up and bucketed. For example if there are three triggers within 7 days of source registrations with values 1, 3 and 4.

```jsonc
{ "event_trigger_data": [{"trigger_data": "0", "value": 1}] }
{ "event_trigger_data": [{"trigger_data": "0", "value": 3}] }
{ "event_trigger_data": [{"trigger_data": "0", "value": 4}] }
```

The values are summed (to 8) and reported in the following reports after 7 days:

```jsonc
// Report 1
{
  ...
  "trigger_summary_bucket": [5, 9]
}
```

In the subsequent 7 days, the following triggers are registered:

```jsonc
{ "event_trigger_data": [{"trigger_data": "0", "value": 50}] }
{ "event_trigger_data": [{"trigger_data": "0", "value": 45}] }
```

The values are summed to 8 + 50 + 45 = 103. This yields the following reports at 14 days:

```jsonc
// Report 2
{
  ...
  "trigger_summary_bucket": [10, 99]
},

// Report 3
{
  ...
  "trigger_summary_bucket": [100, MAX_UINT32]
}
```

### Reporting trigger counts

This example shows how a developer can configure a source to get a count of triggers up to 10.

```jsonc
{
  "trigger_data_matching": "exact",
  "trigger_specs": [{
    "trigger_data": [0],
    "event_report_windows": {
      "end_times": [604800] // 7 days represented in seconds
    },
    // This field could be omitted to save bandwidth since the default is "count"
    "summary_window_operator": "count",
    "summary_buckets": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  }],
}
```

Attributed triggers with `trigger_data` set to 0 are counted and capped at 10. The trigger value is ignored since `summary_window_operator` is set to `count`. Supposing 4 triggers are registered and attributed to the source, the reports would look like this:

```jsonc
// Report 1
{
  ...
  "trigger_summary_bucket": [1, 1]
}
// Report 2
{
  ...
  "trigger_summary_bucket": [2, 2]
}
// Report 3
{
  ...
  "trigger_summary_bucket": [3, 3]
}
// Report 4
{
  ...
  "trigger_summary_bucket": [4, 4]
}
```

#### Binary with more frequent reporting

This example configuration supports a developer who wants to learn whether at least one conversion occurred in the first 10 days (regardless of value), but wants to receive reports at more frequent intervals than the default. Again, in this example any trigger that sets `trigger_data` to a value other than 0 is ineligible for attribution. This is why we refer to this use case as _binary_

```jsonc
{
  "trigger_data_matching": "exact",
  "trigger_specs": [{
    "trigger_data": [0],
    "event_report_windows": {
      // 1 day, 2 days, 3 days, 5 days, 7 days, 10 days represented in seconds
      "end_times": [86400, 172800, 259200, 432000, 604800, 864000]
    },
    // This field could be omitted to save bandwidth since the default is "count"
    "summary_window_operator": "count",
    "summary_buckets": [1]
  }],
}
```

### Varying `trigger_specs` from source to source

Note that the `trigger_specs` registration can differ from source to source.
This example has two configurations, one that specifies that only triggers with
`trigger_data` 0-3 are eligible for attribution and another that specifies that
only triggers with `trigger_data` 4-7 are eligible. The user can configure half
their sources with the former and half their sources with the later. Doing so
will result in the noise added to the report being approximately 15% of the
noise of the default configuration for navigation sources. However, assuming no
other changes, it may result in a greater number of unattributed triggers: If a
trigger is attributed to a source with no matching `trigger_data`, the trigger
is dropped.

```jsonc
{
  "trigger_data_matching": "exact",
  "trigger_specs": [{
    "trigger_data": [0, 1, 2, 3],
    "event_report_windows": {
      "end_times": [172800, 604800, 2592000] // 2 days, 7 days, 30 days represented in seconds
    }
  }],
  "max_event_level_reports": 3
}
```

```jsonc
{
  "trigger_data_matching": "exact",
  "trigger_specs": [{
    "trigger_data": [4, 5, 6, 7],
    "event_report_windows": {
      "end_times": [172800, 604800, 2592000] // 2 days, 7 days, 30 days represented in seconds
    }
  }],
  "max_event_level_reports": 3
}
```

We encourage developers to suggest different use cases they may have for this API extension, and we will update this explainer with sample configurations for those use cases.

## Privacy considerations

We will publish an [algorithm](https://github.com/WICG/attribution-reporting-api/tree/main/flexible-event) which computes the number of output states for a given source registration. From this we will be able to:

* Compute a randomized response algorithm across the entire output space
* Set the noise level to satisfy a certain epsilon level via a randomized response mechanism
* Verify that the privacy parameters (like information gain) are within a given threshold, and fail registration if they are not

With these pieces we can ensure that these extensions do not exceed certain privacy parameters. Additionally, it allows callers to fine-tune the noise added to the API e.g. by specifying different kinds of output domains. For example, navigation sources that only need 1 bit of trigger data and 1 reporting window can use the same noise level as event sources.

Beyond setting noise levels, we will have some parameter limits to avoid large computation costs and avoid configurations with too many output states (where noise will increase considerably). Here is an example set of restrictions (feedback always welcome):

* Maximum of 20 total reports, globally and per `trigger_data`
* Maximum of 5 possible reporting windows per `trigger_data`
* Maximum of 32 trigger data cardinality (not applicable for Phase 1: Lite Flexible Event-Level)

Be mindful that using extreme values here may result in a large amount of noise, or failure to register if privacy levels ([information gain](https://github.com/WICG/attribution-reporting-api/blob/main/params/chromium-params.md)) are exceeded. The [flexible-event script](https://github.com/WICG/attribution-reporting-api/tree/main/flexible-event) can be used to analyze different configurations that fall within the privacy levels.
