# Attribution Reporting API with Aggregate Reports

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

- [Authors](#authors)
- [Participate](#participate)
- [Introduction](#introduction)
- [Goals](#goals)
- [API changes](#api-changes)
  - [Attribution source registration](#attribution-source-registration)
  - [Attribution trigger registration](#attribution-trigger-registration)
  - [Aggregate attribution reports](#aggregate-attribution-reports)
  - [Privacy budgeting](#privacy-budgeting)
- [Data processing through the aggregation service](#data-processing-through-the-aggregation-service)
  - [High level two-party flow](#high-level-two-party-flow)
  - [Example query model](#example-query-model)
  - [insecure-single-server should be compatible with MPC](#insecure-single-server-should-be-compatible-with-mpc)
- [Privacy considerations](#privacy-considerations)
- [Considered alternatives / follow-up work](#considered-alternatives--follow-up-work)
  - [Larger / sparser histogram domains](#larger--sparser-histogram-domains)
  - [Declarative / HTTP-based aggregation triggering](#declarative--http-based-aggregation-triggering)
  - [Custom attribution models](#custom-attribution-models)
  - [“Count” vs. “value” histograms](#count-vs-value-histograms)
- [References & acknowledgements](#references--acknowledgements)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->


## Authors

* csharrison@chromium.org
* johnidel@chromium.org
* marianar@google.com

## Participate

*   https://github.com/WICG/conversion-measurement-api/issues

## Introduction

This document proposes extensions to our existing [Attribution Reporting API](https://github.com/csharrison/conversion-measurement-api) that reports event-level data. The intention is to provide mechanisms for information to be reported in a way that reporting endpoints can only learn _aggregate data_, not any data associated with a particular click or user. In this way, we can satisfy measurement use cases for which an event-level API would reveal too much private information.

This API builds on the same mechanisms described in the [Multi-browser aggregation service](https://github.com/WICG/conversion-measurement-api/blob/main/SERVICE.md) explainer.

In particular, we introduce experimental mechanisms including:

*   **Bring your own aggregation servers:** anyone can receive reports for aggregation during an initial experimentation period.
*   **Multi-party computation (MPC) optional:** Long-term,  we expect servers will need to process data exclusively with [secure multi-party computation](https://en.wikipedia.org/wiki/Secure_multi-party_computation) (or technology that achieves similar goals), but for an initial experimentation period this is optional.

## Goals

Aggregate attribution reports should support legitimate measurement use cases not already supported by the event-level reports. It should do so in a privacy-safe manner as described [here](https://github.com/WICG/conversion-measurement-api/blob/main/SERVICE.md#high-level-goals).

These include:

*  Higher fidelity measurement of attribution-trigger (conversion-side) data, which is very limited in event-level attribution reports, including the ability to sum _values_ rather than just counts
*  A system which enables the most robust privacy protections
*  Ability to receive reports alongside event-level reports
*  Ability to receive data at a faster rate than with event-level reports

Note: fraud detection is a goal but it is left out of scope for this document. We hope to have a unified fraud model that supports event and aggregate reports.

## API changes

Aggregate reports use the same API base [as event-level reports](https://github.com/WICG/conversion-measurement-api/blob/main/README.md), with a few new extensions.

### Attribution source registration

This adds a new attribute at source registration time (click or view event) called `attributionsourcecontext` which can be an arbitrary string, with a maximum size to accommodate for storage limits (e.g. up to 64 bytes)

```html
<a
  attributionsourceeventid="..."
  attributeon="..."
  attributionreportto="..."
  attributionsourcecontext="campaign123"> ...</a>
```

`attributionsourcecontext` will also be added to the `AttributionSourceParams` dictionary, and can be provided to sources created via the associated JavaScript APIs (including for `event` / view sources).

### Attribution trigger registration

At trigger time, we have a [worklet-style](https://developer.mozilla.org/en-US/docs/Web/API/Worklet) API that allows passing in an arbitrary string of “trigger context” that specifies information about the trigger event (e.g. high fidelity data about a conversion). From within the worklet, code can access both the source and trigger context in the same function to generate an aggregate report. This allows for more dynamic keys than a declarative API (like the existing[ HTTP-based triggering](https://github.com/WICG/conversion-measurement-api#triggering-attribution)), but disallows exfiltrating sensitive cross-site data out of the worklet.

The worklet is used to generate histogram contributions, which are key-value pairs of integers. Note that there will be some maximum number of keys (e.g. 2^32 keys, see the [considered alternative](#considered-alternatives--follow-up-work) for more detail).

The following code triggers attribution by invoking a worklet.
```javascript
await window.attributionReporting.worklet.addModule("https://reporter.com/convert.js");

// The first argument should match the origin of the module we are invoking, and
// determines the scope of attribution similar to the existing HTTP-based API,
// i.e. it should match the "attributionreportto" attribute.
// The last argument needs to match what AggregateAttributionReporter uses upon calling registerAggregateReporter
window.attributionReporting.triggerAttribution("https://reporter.com", 
  <triggerContextStr>, "my-aggregate-reporter");
```

Internally, the browser will look up to see which source should be attributed, similar to how [attribution](https://github.com/WICG/conversion-measurement-api#trigger-attribution-algorithm) works in the HTTP-based API. Note here that only a single source will be matched.

Here is `convert.js` which crafts an aggregate report.

```javascript
class AggregateAttributionReporter {
function processAggregate(triggerContext, attributionSourceContext, sourceType) {
  // First bit of the bucket is the campaign
  var bucket = 0;
  if (attributionSourceContext === "campaign-foo") {
    bucket = 0;
  } else if (attributionSourceContext === "campaign-bar") {
    bucket = 1
  }

  // Second bit distinguishes the sourceType.
  if (sourceType === "navigation") {
    bucket = bucket + 2;
  }
 
  // Use the trigger context to pass some notion of a non-negative conversion value
  let purchaseValue = parseInt(triggerContext, 10)
  histogramContributions = [
    {bucket: bucket, value: purchaseValue}
  ]
  return {
    histogramContributions: histogramContributions,
    processingType: "insecure-single-server", // or "two-party" the default
    aggregationServices: [
      {origin: "https://helper1.com"},
      {origin: "https://helper2.com"},
    ]
  }
}
}

// Bound classes will be invoked when an attribution triggered on this document is
// successfully attributed to a source whose reporting origin matches the worklet
// origin.
registerAggregateReporter("my-aggregate-reporter", AggregateReporter);
```

The `processAggregate` function needs to return:

*   A list of histogram contributions to a histogram with keys that are members of a single _fixed domain_ under some hardcoded limit (like 2<sup>32</sup> keys). Note that this list will have some small max size (e.g. 3). The `value` will be capped at some max size, see the L<sub>inf</sub> parameter  [below](#privacy-budgeting).
*   A processing type which indicates whether we expect the aggregation servers to be running a true MPC protocol.  There are two processing types options, i.e. two values processing\_types can take: 
    *   `two-party` (default): this is more secure. It qualifies as "true MPC", because multiple parties are involved, and neither party can see raw data in the clear.
    *   `insecure-single-server`: this is the less secure option, and is not truly MPC ("non-MPC server"). It's introduced here to easen initial experimentation, because a single server is simpler to set up than a true MPC system. The goal is to eventually deprecate this option as this API matures, in favor of the more secure, true MPC approach.

    Some helper servers might support only one of these processing types, and some might support both. Explicitly specifying the type is useful e.g. for experiments when helpers are trying to migrate off `insecure-single-server`.

*   A list of aggregation services which work together to aggregate the results. For initial experimentation we plan on allowing any origin to be an aggregation service, with the eventual goal of having an explicit allowlist of browser-trusted origins. Note that setting up a fallback mechanism in case these services fail is up to the services themselves. As long as the decryption key is available, reports for a particular service could be processed anywhere.

Actions in the worklet won’t affect the embedder context, to avoid leaking information about the sensitive join of `triggerContext` and `attributionSourceContext`. This means that we need to be careful how errors are handled.

### Aggregate attribution reports

Attribution reports will look very similar to [event-level reports](https://github.com/WICG/conversion-measurement-api#attribution-reports). They will be reported to the configured `attributionreportto` endpoint at the path `.well-known/attribution-reporting/report-aggregate-attribution`. The payload will be JSON encoded with the following scheme:


```
{
  "source_site": "https://publisher.com",
  "attribution_destination": "https://advertiser.com",
  "scheduled_report_time": <timestamp in msec>,
  "aggregation_service_payloads": [
    {
      "origin": "https://helper1.com",
      "payload": "<base64 encoded encrypted data>"
    },
    {
      "origin": "https://helper2.com",
      "payload": "<base64 encoded encrypted data>"
    }
  ],
  "privacy_budget_key": "<field for server to do privacy budgeting>",
  "version": "<api version>"
}
```


Reports will not be delayed to the same extent as they are for event level reports. It may be possible to send these with as little delay as ~0-1 hour.

The `scheduled_report_time` will be the number of milliseconds since the Unix Epoch (1970-01-01T00:00:00Z, ignoring leap seconds) to align with [DOMTimestamp](https://heycam.github.io/webidl/#DOMTimeStamp). It represents the time the browser initially scheduled the report to be sent (to avoid noise around offline devices reporting late).

The `payload` will need to contain all the information needed for the aggregation services to do their jobs. It will need to contain:


*   Histogram contributions. For the MPC protocol we propose initially to use incremental[ distributed point functions](https://github.com/google/distributed_point_functions) (see [issue](https://github.com/WICG/conversion-measurement-api/issues/116)) which form the most flexible and robust protocols we know about. For the insecure-single-server design we will send the data in the clear to one of the processing origins, and a “null” record to the other (at random).
*   Privacy budgeting metadata. which could be some combination of `scheduled_report_time`, `attribution_destination` and the reporting origin (e.g. some function of information available in the clear to the reporter). This information can be used to bound how often batches of reports are sent for aggregation. Adding this to the encrypted payload makes this information immutable by the reporter. It should also be returned outside the payload to allow the reporting origin to maintain similar budgets.

The payload should be encrypted via [HPKE](https://datatracker.ietf.org/doc/draft-irtf-cfrg-hpke/), to public keys specified by the processing origins at some well-known address  `/.well-known/aggregation-service/keys.json` that the browser can fetch. Note that we are avoiding using the `attribution-reporting` namespace because many APIs may want to use this infrastructure beyond attribution reporting.

**TODO**: more formally specify `payload`.


### Privacy budgeting

Each attribution can make multiple contributions to an underlying aggregate histogram, and a given user can trigger multiple attributions for a particular source / trigger site pair. Our goal in this section is to _bound_ the contributions any user can make to a histogram, in a given time window.

 These bounds can be characterized by a few parameters:

*   L<sub>1</sub> → The maximum sum of the contributions (values) across all buckets.
*   T → the time period these limits are enforced on

These parameters define the  L<sub>1</sub> sensitivity on the histogram defined by the (T time window, source site, destination site, user)-tuple and can help us bound privacy loss via differential privacy.

Exceeding these limits will cause future contributions to silently drop.  Exposing failure in any kind of error interface can be used to leak sensitive information out of the worklet, though we might be able to reveal aggregate failure results via some other monitoring side channel.

**Note:** We might want to consider multiple time windows (e.g. a daily limit and a separate weekly limit), or fine grained limits per attribution (to bound “record-level” privacy).

**Note:** We may consider adding additional constraints (like limiting the L0 or Linf sensitivity of the API)

**Note:** More advanced budgeting may be needed to split the budget across multiple parties.

**Note:** The design for the aggregation service also requires some amount of budgeting to ensure records aren’t processed too many times.

Here are some strawman / example parameters:

*   L<sub>1</sub> = 2^16
*   T = 7 days
*   epsilon\_7d = 7/6 for an effective epsilon\_30d of 5

This would yield noise with standard deviation roughly ~80k to every bucket after aggregation (from a Laplace distribution with scale parameter L1 / epsilon_7d). Slicing budgets per 7 days is just an example, we could use finer or coarser units of time to enforce budgets.


## Data processing through the aggregation service

We expect to have more information on the data flow from reporter → processing origins shortly, but what follows is a high level summary.


### High level two-party flow

The high level approach here is described in more detail in the [SERVICE.md](https://github.com/WICG/conversion-measurement-api/blob/main/SERVICE.md) doc. At a high level, the browser will encrypt histogram contribution shares associated with each helper and send them to the reporting endpoint. This is the `payload`. The reporter can then interact with the processing origins to learn shares of the final aggregate output, which can be summed together to learn the full histogram.

The MPC scheme using distributed point functions relies on a fixed output domain, which can be expanded into a full vector. Each processing server returns a “share” of the final vector which represents the fixed domain histogram.

However, large domains (like with 2^32 entries) are difficult to process efficiently. This is mitigated by using [incremental distributed point functions](https://github.com/google/distributed_point_functions), which allow us to make “prefix” queries. Rather than returning the full output domain, reporters can ask the processing origins for sums over any bit-prefix of the output domain. This allows us to implement a “hierarchy of histograms”.

For example, at the extreme, if you have only 4 aggregation keys you want to measure, you could use the lowest order 2 bits in your 32 bit aggregation key space, and query just on that.

This scheme could also support dynamic re-aggregation where the same data is evaluated multiple times over multiple levels of a hierarchy to learn a sparse domain. This is aided by the ability to evaluate only a portion of the domain which helps for large domain sizes. This could even be done by the processing origins themselves, which can jointly work to evaluate a hierarchy, and return the hierarchy back to the reporter.  It is also possible to enforce restrictions on the portion of the domain queried, which could improve privacy in some ways (e.g. so you couldn’t have a bucket-per-user).

**Note:** as new and improved protocols are invented, we can consider adding them to the API in some form, this includes other aggregation functions like using larger domains (> 2^32) with some thresholding mechanism.

**Note:** As mentioned in the [SERVICE.md](https://github.com/WICG/conversion-measurement-api/blob/main/SERVICE.md) doc, we are planning on adding differential privacy noise to the output of the MPC computation. For hierarchical computation, this will require adding noise to each level.

### Example query model

The following is a high level query model that could be achieved with the incremental distributed point function (DPF) primitive.

Imagine the following prefix-tree of counts, where each key is 3 bits long in total (last level of the tree)
```
1-bit prefix counts:       102                   402
2-bit prefix counts:    99       3           400       2
3-bit prefix counts: 99   0    1   2      200   200   1  1
```


We could have a query configuration asking for counts at every prefix level, with some strategy for iterating down and pruning the tree.


```
{
  "prefix_lengths": [1, 2, 3],

  // assume no noise for simplicity, this setting could allow distributing the
  // noise across levels in some non-uniform fashion.
  "privacy_budget_per_prefix": [...],

  // Don't expand a node if it doesn't reach the threshold.
  "expansion_threshold_per_prefix": [5, 5, 5]
}
```

The output (after merging results from two servers) could look like this, where the aggregate data is returned for all queried prefixes.


```
[
  {
    "prefix_length": 1,
    "histogram": {0: 102, 1: 402},
    "expansion_threshold": 5
  },
  {
    "prefix_length": 2,
    "histogram": {0: 99, 1: 3, 2: 400, 3: 2},
    "expansion_threshold": 5
  },
  {
    "prefix_length": 3,
    // Note dropped buckets due to thresholding on the previous histogram
    "histogram": {0: 99, 1: 0, 4: 200, 5: 200},
    "expansion_threshold": 5
  }
]
```

### insecure-single-server as an interim step


We are introducing insecure-single-server to make it easier to initially support the API with server infrastructure. The MPC architecture is non-trivial and it might take some time to spin up a fully productionized system. Though a misbehaving single server could recover 3p-cookie-like functionality by revealing raw data without aggregating, mitigations like server audits could be used in the interim while MPC systems are being developed, to establish a baseline of trust in the server infrastructure.

Note that even for the “insecure-single-server” option for aggregate reports we would ideally strive to make the API as “MPC-like” as possible. That is:


*   **Payload similarity:** Reports from the browser will be encrypted and split into two “pseudo” shares (i.e. one null and one cleartext). From the reporting endpoint’s perspective, these should look indistinguishable from MPC reports.
*   **Output similarity:** Processing origins that receive insecure-single-server results should craft their _output_ as if they were actually computing via MPC. In other words, if the MPC output would be to have each server output a vector-share histogram, the insecure-single-server servers should do that too (e.g. by splitting the cleartext histogram after aggregation), with each “helper” returning a share each, even if the computation was done all on one server.

The ideal state would be to make MPC a **backend implementation detail** for aggregation service origin pairs, and they could migrate to without any API breaking changes for end consumers (i.e. “reporters”) once `insecure-single-server` is flipped to `two-party`. However, we understand that the current MPC protocol using distributed point functions imposes difficult restrictions on how data can be aggregated, even in a single-server design. Server designs during experimentation are free to experiment with other aggregation functions / output and provide feedback if other techniques work better for utility.


## Privacy considerations

This proposal introduces a new isolated worklet-style computation model where sensitive, fine grained data from two sites can be joined together (attribution source and trigger data).

However, data from the worklet can only be used to compute histogram contributions which will be protected by aggregation and differential privacy. It should not be possible to exfiltrate other data from the worklet.

The private histograms supported in the API may end up having large domains (e.g. 2^32 possible buckets or more), but:

*   By adding differentially private noise proportional to one user’s contributions to each bucket, we protect users even if an adversary slots each user into their own distinct bucket
*   We can consider adding limits to the number of _non-zero_ buckets in a final histogram output by the aggregation service


## Considered alternatives / follow-up work


### Larger / sparser histogram domains

It would be great for utility to support even larger histogram domains (e.g. arbitrary strings) over a domain with a fixed max number of keys, but currently we aren’t confident in any MPC protocols that can support them securely. If these are discovered we could add another option to the API to allow this kind of aggregation.

Some of these techniques are explored in [private\_histograms.md](https://github.com/WICG/conversion-measurement-api/blob/master/private_histograms_mpc.md) but the ideas there are provisional. Note that for large domains, to satisfy differential privacy we will need to implement some form of _thresholding_.

Additionally, there are some privacy benefits of smaller domains for aggregation, in that it is helpful if it is difficult to map individual users (or user IDs crossed with other information) to individual buckets, especially in higher epsilon DP regimes.


### Declarative / HTTP-based aggregation triggering

In general, it is undesirable to require JavaScript on the attribution trigger registration. Many existing conversion use-cases use HTTP to register conversions. It is challenging to densely encode an aggregation key space (e.g. in 32 bits) with two disjoint identifiers (source and destination), but it would be good to support this case if possible.

### Custom attribution models

The worklet based scheme possibly allows for more flexible attribution options, including specifying partial “credit” for multiple previous attribution sources that would provide value to advertisers that are interested in attribution models other than last-touch.

### “Count” vs. “value” histograms

There are some use-cases which require something close to binary input (i.e. counting conversions), and other conversions which require summing in some discretized domain (e.g. summing conversion value).

For simplicity in this API we are treating these exactly the same. Count-based approaches could do something like submitting two possible values, 0 for 0 and MAX\_VALUE for 1, and consider the large space to be just a discretized domain of fractions between 0 and 1.

This has the benefit of keeping the aggregation infrastructure generic and avoids the need to “tag” different reports with whether they represent a coarse-grained or fine-grained value.

In the end, we will use this MAX\_VALUE to scale noise for differential privacy (via computing the sensitivity of the computation), so submitting “1” for counts will yield more noise than otherwise expected.

## References & acknowledgements


*   Dan Boneh et al. for the MPC protocol in https://arxiv.org/abs/2012.14884
