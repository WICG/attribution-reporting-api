# Flexible event-level configurations

_Note: This document describes possible new functionality in the Attribution Reporting API’s event-level reports. This is a forwards and backwards compatible change to event-level reports. While this new functionality is being developed, we still highly encourage testing the existing API functionalities to support core utility and compatibility needs._

**Table of Contents**

- [Goals](#goals)
- [Phase 1: Lite Flexible Event Level](#phase-1-lite-flexible-event-level)
  - [API Changes](#api-changes)
  - [Default Configurations](#default-configurations)
    - [Default event sources](#default-event-sources)
    - [Default navigation sources](#default-navigation-sources)
    - [Custom Configurations: Example](#custom-configurations-example)
- [Phase 2: Full Flexible Event Level](#phase-2-full-flexible-event-level)
  - [API Changes](#api-changes)
  - [Default Configurations](#default-configurations)
    - [Default event sources](#default-event-sources)
    - [Default navigation sources](#default-navigation-sources)
    - [Custom Configurations: Examples](#custom-configurations-examples)
      - [Reporting trigger value buckets](#reporting-trigger-value-buckets)
      - [Reporting trigger counts](#reporting-trigger-counts)
      - [Binary with more frequent reporting](#binary-with-more-frequent-reporting)
      - [Varying trigger_specs from source to source](#varying-trigger_specs-from-source-to-source)
- [Privacy Considerations](#privacy-considerations)

The default configuration for event and navigation sources may not be ideal for all use-cases. We can optionally support extended configurations that allow for callers to specify precisely the information they want out of reports, in order to more efficiently extract utility out of the privacy mechanism. The most efficient configuration will differ from use-case to use-case and will depend on a) the parameters of our privacy mechanism and b) the noise level that can be tolerated by the use-case.

This proposal is broken into two separate feature sets
* __Phase 1: Lite flexible event level configuration__
  * This lite version would provide a subset of the full feature and can be used independently of Phase 2
* __Phase 2: Full version of flexible event level configuration__
<br>

Phase 1 (Lite flexible event level) could be used to:
* Vary the frequency of reports by specifying the number of reporting windows
* Vary the number of attributions per source registration
* Reduce the amount of total noise by decreasing the above parameters
* Configure reporting windows rather than using the defaults
<br>

Phase 2 (Full flexible event level) could be used to do all of the capabilities in Phase 1 and:
* Vary the trigger data cardinality in a report
* Reduce the amount of total noise by decreasing the trigger data cardinality

## Goals

In general, the approach here is to more flexibly encode the output of the API for event-level reports:

* Allow tuning the output space for a particular source, trading off richness of output (e.g. cardinality of `trigger_data`, number of reporting windows, etc.) with noise levels (See [issue #99](https://github.com/WICG/attribution-reporting-api/issues/99), [issue #734](https://github.com/WICG/attribution-reporting-api/issues/734), and [issue #733](https://github.com/WICG/attribution-reporting-api/issues/733))
* Allow for value-based reporting (via bucketization) in addition to count-based reporting ([issue #55](https://github.com/WICG/attribution-reporting-api/issues/55))
* Allow for choosing flexible reporting windows ([issue #46](https://github.com/WICG/attribution-reporting-api/issues/46) and [issue #736](https://github.com/WICG/attribution-reporting-api/issues/736))
* Allow for setting the possible output space for a source based on a _prior probability distribution_ the ad tech has about the types of trigger that are possible, taking advantage of recent research into label differential privacy for [binary classification](https://arxiv.org/abs/2102.06062) and [regression problems](https://arxiv.org/abs/2212.06074).

## Phase 1: Lite Flexible Event Level

### API Changes

We will add the following two optional parameters to the JSON in `Attribution-Reporting-Register-Source`: `max_event_level_reports` and `event_report_windows`:

```jsonc
{
  ...
  // Optional. This is a parameter that acts across all trigger types for the lifetime of this source. 
  // It restricts the total number of event-level reports that this source can generate. 
  // After this maximum is hit, the source is no longer capable of producing any new data. 
  // The use of priority in the trigger attribution algorithm in the case of multiple attributable triggers remains unchanged. 
  // Defaults to 3 for navigation sources and 1 for event sources
  "max_event_level_reports": <int>,

  // Optional. Represents a series of time windows, starting at 0.
  // Reports for this source will be delivered an hour after the end of each window.
  // Time is encoded as seconds after source registration.
  // If event_report_windows is omitted, will use the default windows.
  // This field is mutually exclusive with the existing `event_report_window` field.
  // End time is exclusive.
  "event_report_windows": {
    "end_times": [<int>, ...]
  }
}
```

Note that if both `event_report_window` and `event_report_windows` are present then the source will be ignored. Only one of them can be present in the source registration.

### Default Configurations
Here are the default configurations for `event` and `navigation` sources.

#### Default event sources

```jsonc
{
  ...  
  "max_event_level_reports": 1,
  "event_report_windows": {
    "end_times": [2592000] // 30 days represented in seconds
  }
}
```

#### Default navigation sources

```jsonc
{
  ...  
  "max_event_level_reports": 3,
  "event_report_windows": {
    "end_times": [172800, 604800, 2592000] //This is <2 days>, <7 days>, <30 days> represented in seconds
  }
}
```

#### Custom Configurations: Example

Below is an additional configuration example outside the defaults. This example configuration supports a developer who wants to optimize for receiving reports at earlier reporting windows.

```jsonc
{
  ...  
  "max_event_level_reports": 3,
  "event_report_windows": {
    "end_times": [7200, 43200, 86400] //This is <2 hours>, <12 hours>, and <1 day> represented in seconds
  }
}
```

## Phase 2: Full Flexible Event Level

### API changes

In addition to the parameters that were added in Phase 1, we will add one additional optional parameter to the JSON in `Attribution-Reporting-Register-Source`: `trigger_specs`

```jsonc
{
  // A trigger spec is a set of matching criteria, along with a scheme to
  // generate bucketized output based on accumulated values across multiple
  // triggers within the specified event_report_window.
  // There will be a limit on the number of specs possible to define for a source.
  "trigger_specs": [{
    // This spec will only apply to registrations that set one of the given
    // trigger data values (non-negative integers) in the list.
    // trigger_data will still appear in the event-level report.
    "trigger_data": [<int>, ...]

    // Represents a series of time windows, starting at <start time>.
    // Reports for this spec will be delivered an hour after the end of each window.
    // Time is encoded as seconds after source registration.
    //
    // Note: specs with identical trigger_data cannot have overlapping windows;
    // this ensures that triggers match at most one spec. If event_report_windows
    // is omitted, will use the "event_report_window" or "event_report_windows" field specified at the global level for the source (or the defaul windows if none are specified).  End time is exclusive.
    "event_report_windows": {
      "start_time": <int>, // Optional, defaults to 0.
      "end_times": [<int>, ...]
    }

    // Represents an operator that summarizes the triggers within a window
    // count: number of triggers attributed within a window
    // value_sum: sum of the value of triggers within a window
    // The summary is reported as an index into a bucketization scheme.
    // Defaults to "count"
    "summary_window_operator": <one of "count" or "value_sum">

    // Represents a bucketization of the integers from [0, MAX_INT], encoded as
    // a list of integers where new buckets begin (excluding 0 which is
    // implicitly included).
    //
    // e.g. [5, 10, 100] encodes the following ranges:
    // [[0, 4], [5, 9], [10, 99], [100, MAX_INT]]
    //
    // If omitted, then represents a trivial mapping
    // [1, 2, ... , MAX_INT]
    // With MAX_INT being the maximum int value defined by the browser.
    "summary_buckets": [<bucket start>, ...]
  }, {
    // Next trigger_spec
  } ...],

  // See description in phase 1.
  "max_event_level_reports": <int>
  // See description in phase 1.
  "event_report_windows": {
    "end_times": [7200, 43200, 86400] //This is <2 hours>, <12 hours>, and <1 day> represented in seconds
  }
}
```

This configuration fully specifies the output space of the event-level reports, per source registration. For every trigger spec, we fully specify:
* A set of matching criteria:
  * Which specific trigger data this spec applies to. This source is eligible to be matched only with triggers that have one of the specified `trigger_data` values in the `trigger_specs`. In other words, if the trigger would have matched this source but its `trigger_data` is not one of the values in the source's configuration, the trigger is ignored.
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
    * The top level `event_reporting_windows` will act as a default value in case any trigger spec is the missing `event_report_windows` sub-field
* The first matched spec is chosen for attribution, and we increment its summary value by `value`.

When the `event_report_window` for a spec completes, we will map it's summary value to a bucket, and send an event-level report for every increment in the summary bucket caused by attributed trigger values. Reports will come with one extra field `trigger_summary_bucket`.

```jsonc
{
  ...
  "trigger_summary_bucket": [<bucket start>, <bucket end>],
}
```

### Default configurations

Here are the default configurations for event and navigation sources. Especially for navigation sources, this illustrates why the noise levels are so high relative to event sources to maintain the same epsilon values: navigation sources have a much larger output space.


#### Default event sources

```jsonc
{
  "trigger_specs": [
  {
    "trigger_data": [0, 1],
  }],
  "max_event_level_reports": 1
}
```

#### Default navigation sources

```jsonc
{
  "trigger_specs": [
  {
    "trigger_data": [0, 1, 2, 3, 4, 5, 6, 7],
    "event_report_windows": {
      "end_times": [172800, 604800, 2592000] //This is <2 days>, <7 days>, <30 days> represented in seconds
    }
  }],
  "max_event_level_reports": 3
}
```

### Custom configurations: Examples

Below are some additional configurations outside the defaults. In all of the below examples, the user (developer) is either trading-off
* reducing some dimension of the default configuration (#triggers, trigger data cardinality, #windows) for increasing another one to preserve the noise level
* reducing some dimension of the default configuration (#triggers, trigger data cardinality, #windows) for reduced noise level

#### Reporting trigger value buckets

This example configuration supports a developer who wants to optimize for value data for only one reporting window (e.g. 7 days), trading fewer reporting windows for less noise. In this example any trigger that sets trigger_data to a value other than 0 is ineligible for attribution.

```jsonc
{
  "trigger_specs": [
  {
    "trigger_data": [0],
    "event_report_windows": {
      "end_times": [604800] //This is <7 days> represented in seconds
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

The values are summed (to 8) and only 1 report is sent reported as bucket [5, 9].

```jsonc
{
  ...
  "trigger_summary_bucket": [5, 9]
}
```

#### Reporting trigger counts

This example shows how a developer can configure a source to get a count of triggers up to 10.

```jsonc
{
  "trigger_specs": [
  {
    "trigger_data": [0],
    "event_report_windows": {
      "end_times": [604800] //This is <7 days> represented in seconds
    },
    // This field could be omitted to save bandwidth since the default is "count"
    "summary_window_operator": "count",
    "summary_buckets": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  }],
}
```

Attributed triggers with `trigger_data` set to 0 are counted and capped at 10. The trigger value is ignored since `summary_window_operator` is set to `count`. Supposing 4 triggers are registered and attributed to the source, the report would look like this:

```jsonc
{
  ...
  "trigger_summary_bucket": [4, 4]
}
```

#### Binary with more frequent reporting

This example configuration supports a developer who wants to learn whether at least one conversion occurred in the first 10 days (regardless of value), but wants to receive reports at more frequent intervals than the default. Again, in this example any trigger that sets `trigger_data` to a value other than 0 is ineligible for attribution. This is why we refer to this use case as _binary_

```jsonc
{
  "trigger_specs": [
  {
    "trigger_data": [0],
    "event_report_windows": {
      // This is <1 days>, <2 days>, <3 days> <5 days>, <7 days>, <10 days> represented in seconds
      "end_times": [86400, 172800, 259200, 432000, 604800, 864000]
    },
    // This field could be omitted to save bandwidth since the default is "count"
    "summary_window_operator": "count",
    "summary_buckets": [1]
  }],
}
```

### Varying `trigger_specs` from source to source

Note that the `trigger_specs` registration can differ from source to source. This example has two configurations, one that specifies that only triggers with `trigger_data` 0-3 are eligible for attribution and another that specifies that only triggers with `trigger_data` 4-7 are eligible. The user can configure half their sources with the former and half their sources with the later. Doing so will result in the noise added to the report being approximately 15% of the noise of the default configuration for navigation sources.

```jsonc
{
  "trigger_specs": [
  {
    "trigger_data": [0, 1, 2, 3],
    "event_report_windows": {
      "end_times": [172800, 604800, 2592000] //This is <2 days>, <7 days>, <30 days> represented in seconds
    }
  }],
  "max_event_level_reports": 3
}
```

```jsonc
{
  "trigger_specs": [
  {
    "trigger_data": [4, 5, 6, 7],
    "event_report_windows": {
      "end_times": [172800, 604800, 2592000] //This is <2 days>, <7 days>, <30 days> represented in seconds
    }
  }],
  "max_event_level_reports": 3
}
```

We encourage developers to suggest different use cases they may have for this API extension, and we will update this explainer with sample configurations for those use cases.


## Privacy considerations

The goal of both Phase 1 and Phase 2 of this proposal is to remain largely privacy-neutral with respect to the existing event-level reports. We will publish an algorithm which computes the number of output states for a given source registration. From this we will be able to:

* Compute a randomized response algorithm across the entire output space
* Set the noise level to satisfy a certain epsilon level via a randomized response mechanism
* Verify that the privacy parameters (like information gain) are within a given threshold, and fail registration if they are not

With these pieces we can ensure that these extensions do not regress our privacy measures. Additionally, it allows callers to fine-tune the noise added to the API e.g. by specifying different kinds of output domains. For example, navigation sources that only need 1 bit of trigger data and 1 reporting window can use the same noise level as event sources.

Beyond setting noise levels, we will have some parameter limits to avoid large computation costs and avoid configurations with too many output states (where noise will increase considerably). Here is an example set of restrictions (feedback always welcome):


* Maximum of 20 total reports, globally and per `trigger_data`
* Maximum of 5 possible reporting windows per `trigger_data`
* Maximum of 32 trigger data cardinality (not applicable for Phase 1: Lite Flexible Event Level)

Be mindful that using extrema values here may result in a large amount of noise, or failure to register if privacy levels are not met.

