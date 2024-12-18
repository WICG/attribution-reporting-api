# Attribution Reporting API with Aggregatable Reports

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

- [Authors](#authors)
- [Introduction](#introduction)
- [Goals](#goals)
- [API changes](#api-changes)
  - [Attribution source registration](#attribution-source-registration)
  - [Attribution trigger registration](#attribution-trigger-registration)
  - [Aggregatable reports](#aggregatable-reports)
    - [Encrypted payload](#encrypted-payload)
  - [Optional: transitional debugging reports](#optional-transitional-debugging-reports)
    - [Attribution-success debugging reports](#attribution-success-debugging-reports)
    - [Verbose debugging reports](#verbose-debugging-reports)
  - [Contribution bounding and budgeting](#contribution-bounding-and-budgeting)
  - [Storage limits](#storage-limits)
  - [Hide the true number of attribution reports](#hide-the-true-number-of-attribution-reports)
  - [Optional: reduce report delay with trigger context ID](#optional-reduce-report-delay-with-trigger-context-id)
  - [Optional: flexible contribution filtering with filtering IDs](#optional-flexible-contribution-filtering-with-filtering-ids)
  - [Optional: named budgets](#optional-named-budgets)
- [Data processing through a Secure Aggregation Service](#data-processing-through-a-secure-aggregation-service)
- [Privacy considerations](#privacy-considerations)
  - [Differential Privacy](#differential-privacy)
- [Ideas for future iteration](#ideas-for-future-iteration)
  - [Worklet-based aggregation key generation](#worklet-based-aggregation-key-generation)
  - [Custom attribution models](#custom-attribution-models)
  - [More advanced contribution bounding](#more-advanced-contribution-bounding)
  - [Choosing among aggregation services](#choosing-among-aggregation-services)
- [Considered alternatives](#considered-alternatives)
  - [“Count” vs. “value” histograms](#count-vs-value-histograms)
  - [Binary report format](#binary-report-format)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->


## Authors

* Charlie Harrison (csharrison@chromium.org)
* John Delaney (johnidel@chromium.org)
* Mariana Raykova (marianar@google.com)
* Nan Lin (linnan@chromium.org)

## Introduction

This document proposes extensions to our existing [Attribution Reporting
API](https://github.com/WICG/attribution-reporting-api) that reports
event-level data. The intention is to provide a mechanism for rich metadata to
be reported in aggregate, to better support use-cases such as campaign-level
performance reporting or conversion values.

## Goals

Aggregatable attribution reports should support legitimate measurement use cases
not already supported by the event-level reports. These include:

*  Higher fidelity measurement of attribution-trigger (conversion-side) data,
   which is very limited in event-level attribution reports, including the
   ability to sum _values_ rather than just counts
*  A system which enables the most robust privacy protections
*  Ability to receive aggregatable reports alongside event-level reports
*  Ability to receive data at a faster rate than with event-level reports
*  Greater flexibility to trade off attribution-trigger (conversion-side) data,
   reporting rate and accuracy.

Note: fraud detection (enabling the filtration of reports you are not expecting)
is a goal but it is left out of scope for this document for now.

## API changes

The client API for creating contributions to an aggregate report uses the same
API base as for event level reports  with a few extensions. In the following
example an ad-tech will use the API to collect:
* Aggregate conversion counts at a per-campaign level
* Aggregate purchase values at a per geo level 
### Attribution source registration

Registering sources eligible for aggregate reporting entails adding a new
`aggregation_keys` dictionary field to the JSON dictionary of the
[`Attribution-Reporting-Register-Source` header](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#registering-attribution-sources):
```jsonc
{
  ... // existing fields, such as `source_event_id` and `destination`

  "aggregation_keys": {
    // Generates a "0x159" key piece (low order bits of the key) for the key named
    // "campaignCounts".
    "campaignCounts": "0x159", // User saw ad from campaign 345 (out of 511)

    // Generates a "0x5" key piece (low order bits of the key) for the key named "geoValue".
    "geoValue": "0x5" // Source-side geo region = 5 (US), out of a possible ~100 regions
  },

  "aggregatable_report_window": "86400"
}
```
This defines a dictionary of named aggregation keys, each with a piece of the
aggregation key defined as a hex-string. The final histogram bucket key will be
fully defined at trigger time using a combination (binary OR) of this piece and
trigger-side pieces.

Final keys will be restricted to a maximum of 128 bits. This means that hex
strings in the JSON must be limited to at most 32 digits.

There is also a new optional field, `aggregatable_report_window`, which is the duration 
in seconds after source registration during which aggregatable reports may be created 
for this source.

### Attribution trigger registration

Trigger registration will also add two new fields to the JSON dictionary of the
[`Attribution-Reporting-Register-Trigger`
header](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#triggering-attribution):
```jsonc
{
  ... // existing fields, such as `event_trigger_data`

  "aggregatable_trigger_data": [
    // Each dict independently adds pieces to multiple source keys.
    {
      // Conversion type purchase = 2 at a 9 bit offset, i.e. 2 << 9.
      // A 9 bit offset is needed because there are 511 possible campaigns, which
      // will take up 9 bits in the resulting key.
      "key_piece": "0x400",
      // Apply this key piece to:
      "source_keys": ["campaignCounts"]
    },
    {
      // Purchase category shirts = 21 at a 7 bit offset, i.e. 21 << 7.
      // A 7 bit offset is needed because there are ~100 regions for the geo key,
      // which will take up 7 bits of space in the resulting key.
      "key_piece": "0xA80",
      // Apply this key piece to:
      "source_keys": ["geoValue", "nonMatchingKeyIdsIgnored"]
    }
  ],
  "aggregatable_values": {
    // Each source event can contribute a maximum of L1 = 2^16 to the aggregate
    // histogram. In this example, use this whole budget on a single trigger,
    // evenly allocating this "budget" across two measurements. Note that this
    // will require rescaling when post-processing aggregates!

    // 1 count =  L1 / 2 = 2^15
    "campaignCounts": 32768,

    // Purchase was for $52. The site's max value is $1024.
    // $1 = (L1 / 2) / 1024.
    // $52 = 52 * (L1 / 2) / 1024 = 1664
    "geoValue": 1664
  }
}
```
The `aggregatable_trigger_data` field is a list of dict which generates
aggregation keys.

The `aggregatable_values` field lists an amount of an abstract "value" to
contribute to each key, which can be integers in [1, 2<sup>16</sup>]. These are attached
to aggregation keys in the order they are generated. See the [contribution
budgeting](#contribution-bounding-and-budgeting) section for more details on how
to allocate these contribution values.

The scheme above will generate the following abstract histogram contributions:
```jsonc
[
// campaignCounts
{
  key: 0x559, // = 0x159 | 0x400
  value: 32768
},
// geoValue:
{
  key: 0xA85, // = 0x5 | 0xA80
  value: 1664
}]
```

Note: the above scheme was used to maximize the [contribution
budget](#contribution-bounding-and-budgeting) and optimize utility in the face
of constant noise. To rescale, simply inverse the scaling factors used above:
```python
L1 = 1 << 16
true_agg_campaign_counts = raw_agg_campaign_counts / (L1 / 2)
true_agg_geo_value = 1024 * raw_agg_geo_value / (L1 / 2)
```

Note: The `filters` field will still apply to aggregatable reports, and each
dict in `aggregatable_trigger_data` can still optionally have filters applied
to it just like for event-level reports.

Note: The `aggregatable_values` field may also be specified as a list of
dictionaries, where each dictionary contains a dictionary `values` of key-value
pairs as outlined above as well as optional `filters` and `not_filters` fields,
allowing trigger registrations to customize how values are contributed to keys
depending on source filter data. If multiple list entries have filters that
match the source's filters, only the first entry and its corresponding values
will be used.

For example:
```jsonc
{
  ...,
  "aggregatable_values": [
    {
      "values": {
        "campaignCounts": 32768,
        "geoValue": 1664
      },
      "filters": {"source_type": ["navigation"]}
    }
  ]
}
```

Trigger registration will accept an optional field
`aggregatable_deduplication_keys` which will be used to deduplicate multiple
triggers containing the same `deduplication_key` for a single source with selective filtering.

```jsonc
{
  ...
  "aggregatable_deduplication_keys": [
    {
      "deduplication_key": "[unsigned 64-bit integer]",
      "filters": {"source_type": ["navigation"]}
    }
  ]
}
```

The browser will create aggregatable reports for a source only if the trigger's
`aggregatable_deduplication_key` has not already been associated with an
aggregatable report for that source.

Note that aggregatable trigger registration is independent of event-level
trigger registration.

### Aggregatable reports

Aggregatable reports will look very similar to event-level reports. They will be
reported via HTTP POST to the reporting origin at the path
`.well-known/attribution-reporting/report-aggregate-attribution`.

The report itself does not contain histogram contributions in the clear. Rather,
the report embeds them in an _encrypted payload_ that can only be read by a
trusted aggregation service known by the browser.

The report will be JSON encoded with the following scheme:

```jsonc
{
  // Info that the aggregation services also need encoded in JSON
  // for use with AEAD.
  "shared_info": "{\"api\":\"attribution-reporting\",\"attribution_destination\":\"https://advertiser.example\",\"report_id\":\"[UUID]\",\"reporting_origin\":\"https://reporter.example\",\"scheduled_report_time\":\"[timestamp in seconds]\",\"source_registration_time\":\"[timestamp in seconds]\",\"version\":\"[api version]\"}",

  // Support a list of payloads for future extensibility if multiple helpers
  // are necessary. Currently only supports a single helper configured
  // by the browser.
  "aggregation_service_payloads": [
    {
      "payload": "[base64-encoded HPKE encrypted data readable only by the aggregation service]",
      "key_id": "[string identifying public key used to encrypt payload]",

      // Optional debugging information, if cookie-based debugging is allowed.
      "debug_cleartext_payload": "[base64-encoded unencrypted payload]",
    },
  ],

  // The deployment option for the aggregation service.
  "aggregation_coordinator_origin": "https://publickeyservice.msmt.aws.privacysandboxservices.com",

  // Optional debugging information (also present in event-level reports),
  // if cookie-based debugging is allowed.
  "source_debug_key": "[64 bit unsigned integer]",
  "trigger_debug_key": "[64 bit unsigned integer]",

  // Optional trigger context ID.
  "trigger_context_id": "example string"
}
```

Reports will not be delayed to the same extent as they are for event level
reports. The browser will delay them with a random delay between 0 to 10
minutes, or with a small delay after the browser next starts up.
The browser is free to utilize techniques like retries to minimize data loss.

* The `shared_info` will be a serialized JSON object. This exact string is used
  as authenticated data for decryption, see [below](#encrypted-payload). The
  string therefore must be forwarded to the aggregation service unmodified. The
  reporting origin can parse the string to access the encoded fields.
  
* The `api` field is a string enum identifying the API that triggered the report.
  This allows the aggregation service to extend support to other APIs in the future. 

* The `scheduled_report_time` will be the number of seconds since the Unix Epoch
  (1970-01-01T00:00:00Z, ignoring leap seconds) to align with
  [DOMTimestamp](https://heycam.github.io/webidl/#DOMTimeStamp) until the
  browser initially scheduled the report to be sent (to avoid noise around
  offline devices reporting late).

* The `source_registration_time` will represent (in seconds since the Unix Epoch) the
  time the source event was registered, rounded down to a whole day.

* The `payload` will contain the actual histogram contributions. It should be be
  encrypted and then base64 encoded, see [below](#encrypted-payload).

Optional debugging fields are discussed [below](#attribution-success-debugging-reports).

#### Encrypted payload
The `payload` should be a [CBOR](https://cbor.io) map encrypted via
[HPKE](https://datatracker.ietf.org/doc/draft-irtf-cfrg-hpke/) and then base64
encoded. The map will have the following structure:

```jsonc
// CBOR
{
  "operation": "histogram",  // Allows for the service to support other operations in the future
  "data": [{
    "bucket": <bucket, encoded as a 16-byte (i.e. 128-bit) big-endian bytestring>,
    "value": <value, encoded as a 4-byte (i.e. 32-bit) big-endian bytestring>,
    // k is equal to the value `aggregatable_filtering_id_max_bytes`, defaults to 1 (i.e. 8-bit).
    "id": <filtering ID, encoded as a k-byte big-endian bytestring, defaults to 0>
  }, ...]
}
```
The browser may encode multiple contributions in the same payload; this is only
possible if all other fields in the report/payload are identical for the
contributions. To avoid revealing the number of contributions in the payload
through its encrypted size, the browser should pad the list of payloads with
'null' (zero value) contributions up to the maximum. In the future, a more
direct padding scheme could be considered.

This encryption should use [AEAD](https://en.wikipedia.org/wiki/Authenticated_encryption)
to ensure that the information in `shared_info` is not tampered with, since the
aggregation service will need that information to do proper replay protection.
The authenticated data will consist of the `shared_info` string (encoded as
UTF-8) with a constant prefix added for domain separation, i.e. to avoid
ciphertexts being reused for different protocols, even if public keys are
shared.

The encryption will use public keys specified by the aggregation service. The
browser will encrypt payloads just before the report is sent by fetching the
public key endpoint (the aggregation service coordinator origin at the path
 `/.well-known/aggregation-service/v1/public-keys`) with an un-credentialed request. The processing origin will
respond with a set of keys which will be stored according to standard HTTP
caching rules, i.e. using Cache-Control headers to dictate how long to store the
keys for (e.g. following the [freshness
lifetime](https://datatracker.ietf.org/doc/html/rfc7234#section-4.2)). The
browser could enforce maximum/minimum lifetimes of stored keys to encourage
faster key rotation and/or mitigate bandwidth usage. The scheme of the JSON
encoded public keys is as follows:

```jsonc
{
  "keys": [
    {
      "id": "[arbitrary string identifying the key (up to 128 characters)]",
      "key": "[base64 encoded public key]"
    },
    // Optionally, more keys.
  ]
}
```

Note: The version in the `.well-known` path may be updated in the future
versions of the spec if the public key serving details change, especially in a
backwards incompatible way.

To limit the impact of a single compromised key, multiple keys (up to a small
limit) can be provided. The browser should independently pick a key uniformly at
random for each payload it encrypts to avoid associating different reports.
Additionally, a public key endpoint should not reuse an ID string for a
different key. In particular, IDs must be unique within a single response to be
valid. In the case of backwards incompatible changes to this scheme (e.g. in
future versions of the API), the endpoint URL should also change.

**Note:** The browser may need some mechanism to ensure that the same set of
keys are delivered to different users.

### Optional: transitional debugging reports

#### Attribution-success debugging reports

If [debugging](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#attribution-success-debugging-reports)
is enabled, additional debug fields will be present in aggregatable reports.
The `source_debug_key` and `trigger_debug_key` fields match those in the
event-level reports. If both the source and trigger debug keys are set, there
will be a `debug_cleartext_payload` field included in the report. It will
contain the base64-encoded cleartext of the encrypted payload to allow downstream
systems to verify that reports are constructed correctly. If both debug keys are
set, the `shared_info` will also include the flag `"debug_mode": "enabled"` to
allow the aggregation service to support debugging functionality on these reports.

Additionally, a duplicate debug report will be sent immediately (i.e. without the
random delay) to a
`.well-known/attribution-reporting/debug/report-aggregate-attribution` endpoint.
The debug reports should be almost identical to the normal reports, including the
additional debug fields. However, the `payload` ciphertext will differ due to
repeating the encryption operation and the `key_id` may differ if the previous
key had since expired or the browser randomly chose a different valid public key.

#### Verbose debugging reports

As outlined in the
  [event-level explainer](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#verbose-debugging-reports),
certain aggregate attribution failures can be monitored as well.

### Contribution bounding and budgeting

Each attribution can make multiple contributions to an underlying aggregate
histogram, and a given user can trigger multiple attributions for a particular
source / trigger site pair. Our goal in this section is to _bound_ the
contributions any source event can make to a histogram.

This bound is characterized by a single parameters: `L1`, the maximum sum of the
contributions (values) across all buckets for a given source event. L1 refers to
the L1 sensitivity / norm of the histogram contributions per source event.

Exceeding these limits will cause future contributions to silently drop.  
While exposing failure in any kind of error interface can be used to leak
sensitive information, we might be able to reveal aggregate failure results via
some other monitoring side channel in the future.

For the initial proposal, set `L1 = 65536`. Note that for privacy, this
parameter can be arbitrary, as noise in the aggregation service will be scaled
in proportion to this parameter. In the example above,  the budget is split
equally between two keys, one for the number of conversions per campaign and the
other representing the conversion dollar value per geography. This budgeting
mechanism is highly flexible and can support many different aggregation
strategies as long as the appropriate scaling is performed on the outputs.

The browser also applies a limit on the number of contributions within a single
report.

Strawman: There should be a limit of 20 contributions per aggregatable report.

### Storage limits

The browser may apply storage limits in order to prevent excessive resource
usage.

Strawman: There should be a limit of 1024 pending aggregatable reports per
destination site.

Note: The storage limits for event-level and aggregatable reports are enforced
independently of each other.

### Hide the true number of attribution reports

The presence or absence of an attribution report leaks some potentially
sensitive cross-site data in the current design. Therefore, revealing the total
count of reports to the reporting origin could leak something sensitive as well
(imagine if the reporting origin only ever registered a conversion or impression
for a single user).

To hide the true number of reports, the browser will add noise to the number of
reports by randomly sending noisy null reports for some fraction of trigger
registrations. Null reports will not check or affect rate limits.

As a lot of the cross site information is embedded in the source registration
time, trigger registration will accept an optional field
`aggregatable_source_registration_time` to allow developers to specify whether
to exclude or include `source_registration_time` field within `shared_info` in the
aggregatable report. The null report rate will need to be higher if
`source_registration_time` is present in the aggregatable report.

```jsonc
{
   ...,
   "aggregatable_trigger_data": ...,
   "aggregatable_values": ...,
   "aggregatable_source_registration_time": "exclude" // or "include", defaults to "exclude" if not present
}
```

Strawman: There should be ~0.05 reports (in expectation) sent for trigger
registrations that exclude the `source_registration_time` field, and ~0.25 reports for
those that include this field.

In order to limit abuse of the protections above, there will be a maximum limit of 20 aggregatable reports per source.

### Optional: reduce report delay with trigger context ID

Trigger registration will accept an optional string field `trigger_context_id`, a
high-entropy ID that represents the data associated with the trigger.

```jsonc
{
  ..., // existing fields
  "trigger_context_id": "example string" // max length 64
}
```

This ID will be embedded unencrypted in the aggregatable report.

To avoid leaking cross-site information through the count of reports with the
given ID, the browser will unconditionally send an aggregatable report on every
trigger registration with a trigger context ID. A null report will be sent in the
case that the trigger registration did not generate an attribution report. The
source registration time will always be excluded from the aggregatable report
with a trigger context ID.

As the trigger context ID in the aggregatable report explicitly reveals the
association between the report and the trigger, these reports can be sent
immediately without delay.

Note: This is an [alternative](https://github.com/WICG/attribution-reporting-api/blob/main/report_verification.md#could-we-just-tag-reports-with-a-trigger_id-instead-of-using-anonymous-tokens)
considered for [report verification](https://github.com/WICG/attribution-reporting-api/blob/main/report_verification.md),
and achieves all of the higher priority [security goals](https://github.com/WICG/attribution-reporting-api/blob/main/report_verification.md#security-goals).
A similar design was proposed for the
[Private Aggregation API](https://github.com/patcg-individual-drafts/private-aggregation-api/blob/main/report_verification.md#shared-storage)
for the purpose of report verification.

### Optional: flexible contribution filtering with filtering IDs

Trigger registration's `aggregatable_values`'s values can be integers or
dictionaries with an optional `filtering_id` field. 

```jsonc
{
  ..., // existing fields
  "aggregatable_filtering_id_max_bytes": 2, // defaults to 1
  "aggregatable_values": {
    "campaignCounts": 32768,
    "geoValue": {
      "value": 1664,
      "filtering_id": "23" // must fit within <aggregatable_filtering_id_max_bytes> bytes
    }
  }
}
```

These IDs will be included in the encrypted aggregatable report payload
contributions.

Queries to the aggregation service can provide a list of allowed filtering IDs
and all contributions with non-allowed IDs will be filtered out.

The filtering IDs need to be unsigned integers limited to a small number of
bytes, (1 byte = 8 bits) by default. We limit the size of the ID space to
prevent unnecessarily increasing the payload size and thus storage and
processing costs.

This size can be increased via the `aggregatable_filtering_id_max_bytes` field.
To avoid amplifying a counting attack due to the resulting different payload
size, the browser will unconditionally send an aggregatable report on every
trigger registration with a non-default (greater than 1) max bytes. A null report
will be sent in the case that the trigger registration did not generate an
attribution report. The source registration time will always be excluded from
the aggregatable report with a non-default max bytes. This behavior is the same
as when a trigger context ID is set.

See [flexible_filtering.md](https://github.com/patcg-individual-drafts/private-aggregation-api/blob/main/flexible_filtering.md) for more details.

### Optional: named budgets

Named budgets is an optional feature that gives API callers the ability 
to manage `L1` contribution budget distribution across different types of
attributions, addressing common challenges such as:

- Allocating the privacy budget between different types of attributions
  (e.g., biddable vs. non-biddable).
- Distributing the budget across multiple product categories to prevent any
  single product category from consuming all available privacy budget.

[Source registrations](#attribution-source-registration) will accept an optional
field `named_budgets`, which is a dictionary used to set the
maximum contribution for each named budget for this source.

```jsonc
{
  ..., // existing fields
  "named_budgets": {
    "budgetName1": 32768,  // Max contribution budget for budgetName1.
    "budgetName2": 32768   // Max contribution budget for budgetName2.
  }
}
```

[Trigger registrations](#attribution-trigger-registration) will accept an
optional field `named_budgets`, which will be used to select the
named budget for the generated aggregatable report.

```jsonc
{
  ..., // existing fields
  "named_budgets": [
    {
      "name": "budgetName1",
      "filters": {"source_type": ["navigation"]}
    }
  ]
}
```

The first named budget from the trigger that matches the source's filter data
will be selected. If there is no budget name specified or no matching filters, the
`L1` contribution budget will still be applied.

When generating an aggregatable report, in addition to performing the 
current `L1` budget limit check, the contributions for the report will
be checked against the available budget with the selected budget name, if applicable.
If the budget is insufficient, the aggregatable report will not be generated.

## Data processing through a Secure Aggregation Service

The exact design of the service is not specified here. We expect to have more
information on the data flow from reporter → processing origins shortly, but
what follows is a high-level summary.

As the browser sends individual aggregatable reports to the reporting origin,
the reporting origin organizes them into
[batches](AGGREGATION_SERVICE_TEE.md#disjoint-batches). The adtech can then send these
batches to the aggregation service.

The aggregation service will aggregate reports within a certain batch, and
respond back with a summary report (aggregate histogram), i.e. a list of keys with associated
_aggregate_ values. It is expected that as a privacy protection mechanism, a
certain amount of noise will be added to each output key's aggregate value.

Currently the aggregation service can be deployed on Amazon Web Services (AWS) and
Google Cloud Platform (GCP). We expect to support other cloud providers in the future. See the [Public Cloud TEE requirements explainer](https://github.com/privacysandbox/protected-auction-services-docs/blob/main/public_cloud_tees.md) for more details. 

Trigger registration will accept an optional string field `aggregation_coordinator_origin`
to allow developers to specify the deployment option for the aggregation service
supported by the browser, e.g. the origin for the aggregation service deployed on
AWS, GCP, and other platforms in the future.

```jsonc
{
  ..., // existing fields
  "aggregation_coordinator_origin": "https://publickeyservice.msmt.aws.privacysandboxservices.com",
}
```

See [allowlist](https://github.com/WICG/attribution-reporting-api/blob/main/aggregation_coordinator_origin_allowlist.md)
of the aggregation service coordinator origins.

## Privacy considerations

This proposal introduces a new set of reports to the API. Alone they do not add
much meaningful cross-site information, so they are fairly benign. However, they
contain encrypted payloads which allow aggregate histograms to be computed.

These histograms should be protected with various techniques with a trusted
server system. For example, it is expected that the histograms will be subject
to noise proportional to the `L1` budget. Additionally, most rate-limits (except
for the maximum number of reports per source) used for event-level reports will
also be enforced for aggregatable reports, which limit the total amount of
information that can be sent out for any one user.


Servers will need to be implemented such that browsers can trust them with
sensitive cross-site data. There are various technologies and techniques that
could be employed (e.g. [Trusted Execution
Environments](https://en.wikipedia.org/wiki/Trusted_execution_environment),
[Multi-party-computation](https://en.wikipedia.org/wiki/Secure_multi-party_computation),
audits, etc) that could satisfy browsers that data is safely aggregated and the
output maintains proper privacy.

### Differential Privacy

A goal of this work is to have a framework which can support differentially
private aggregate measurement. In principle this can be achieved if the
aggregation service adds noise proportional to the `L1` budget in principle,
e.g. noise distributed according to Laplace(L1/epsilon) should achieve epsilon
differential privacy. With small enough values of epsilon, reports for a given
source will be well-protected in an aggregate release.

Note: there are a few caveats about a formal differential privacy claim:
- The scope of privacy in the current design is not user-level, but per-source.
  See [More advanced contribution
  bounding](#more-advanced-contribution-bounding) for follow-up work exploring
  tightening this.
- Our plan is to adjust the level of noise added based on feedback during the
  origin trial period, and our goal with this initial version is to create a
  foundation for further exploration into formally private methods for
  aggregation.
  
  ### Rate limits
  
  Various rate limits outlined in the 
  [event-level explainer](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#reporting-cooldown--rate-limits)
  should also apply to aggregatable reports. The limits should be shared across
  all types of reports.

## Ideas for future iteration

### Worklet-based aggregation key generation

At trigger time, we could have a
[worklet-style](https://developer.mozilla.org/en-US/docs/Web/API/Worklet) API
that allows passing in an arbitrary string of “trigger context” that specifies
information about the trigger event (e.g. high fidelity data about a
conversion). From within the worklet, code can access both the source and
trigger context in the same function to generate an aggregate report. This
allows for more dynamic keys than a declarative API (like the existing[
HTTP-based
triggering](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#triggering-attribution)),
but disallows exfiltrating sensitive cross-site data out of the worklet.

The worklet is used to generate histogram contributions, which are key-value
pairs of integers. Note that there will be some maximum number of keys (e.g.
2^128 keys).

The following code triggers attribution by invoking a worklet.
```javascript
await window.attributionReporting.worklet.addModule(
  "https://reporter.example/convert.js");

// The first argument should match the origin of the module we are invoking, and
// determines the scope of attribution similar to the existing HTTP-based API,
// i.e. it should match the "attributionreportto" attribute.
// The last argument needs to match what AggregateAttributionReporter uses upon
// calling registerAggregateReporter
window.attributionReporting.triggerAttribution("https://reporter.example", 
  <triggerContextStr>, "my-aggregate-reporter");
```

Internally, the browser will look up to see which source should be attributed,
similar to how
[attribution](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#trigger-attribution-algorithm)
works in the HTTP-based API. Note here that only a single source will be
matched.

Here is `convert.js` which crafts an aggregate report.

```javascript
class AggregateAttributionReporter {
  // attributionSourceContext set as "<campaignid>,<geoid>"
  processAggregate(triggerContext, attributionSourceContext, sourceType) {
    let [campaign, geo] = attributionSourceContext.split(',').map(
        x => parseInt(x, 10))
    
    let purchaseValue = parseInt(triggerContext, 10)
    
    histogramContributions = [
      {key: campaign, value: purchaseValue},
      {key: geo, value: purchaseValue},
    ];
    return {
      histogramContributions: histogramContributions,
    }
  }
}

// Bound classes will be invoked when an attribution triggered on this document
// is successfully attributed to a source whose reporting origin matches the
// worklet origin.
registerAggregateReporter("my-aggregate-reporter", AggregateAttributionReporter);
```

This worklet approach provides greatly enhanced flexibility at the cost of
complexity. It introduces a new security / privacy boundary, and there are
several edge cases that must be handled carefully to avoid data loss (e.g. the
document being destroyed while the worklet is processing, unless a
`keepalive`-style mode for worklets is introduced). These issues must be solved
before this design could be considered.

### Custom attribution models

The worklet based scheme possibly allows for more flexible attribution options,
including specifying partial “credit” for multiple previous attribution sources
that would provide value to advertisers that are interested in attribution
models other than last-touch.

We should be careful in allowing reports to include cross site information from
multiple sites, as it could increase the risk of cross site tracking.

### More advanced contribution bounding

We might want to consider bounding contribution at levels other than the source
event level in the future for more robust privacy protection. For instance, we
could bound user contributions per trigger event, or even by {source site,
 destination site, day} for a more user-level bound.

This would likely come at the cost of some utility and complexity, as budgeting
across multiple source events may not be straightforward.

Additionally, there are more sophisticated techniques that can optimize utility
and privacy if we bound more than just the L1 norm of the aggregate histogram.
For instance, we could impose a stricter Linf bound (i.e. bounding the
contribution to any one bucket). Care should be taken to ensure that either:
* A proper compromise is met across various use-cases
* We can support multiple types of contribution bounding for different reporting
  origins without introducing privacy leaks

See [issue 249](https://github.com/WICG/attribution-reporting-api/issues/249)
for more details.

### Choosing among aggregation services

The server can add an optional `alternative_aggregation_mode` string field:

```http
Attribution-Reporting-Register-Trigger: {..., "aggregatable_trigger_data": ..., "aggregatable_values": ..., "alternative_aggregation_mode": "experimental-poplar"}
```

The optional field will allow developers to choose among different options for
aggregation infrastructure supported by the user agent. This value will allow
experimentation with new technologies, and allows us to try out new approaches
without interfering with core functionality provided by the default option. The
`"experimental-poplar"` option will implement a protocol similar to
[poplar VDAF](https://github.com/cfrg/draft-irtf-cfrg-vdaf/blob/main/draft-irtf-cfrg-vdaf.md#poplar1-poplar1)
in the [PPM Framework](https://datatracker.ietf.org/doc/draft-gpew-priv-ppm/).

## Considered alternatives

### “Count” vs. “value” histograms

There are some use-cases which require something close to binary input (i.e.
counting conversions), and other conversions which require summing in some
discretized domain (e.g. summing conversion value).

For simplicity in this API we are treating these exactly the same. Count-based
approaches could do something like submitting two possible values, 0 for 0 and
MAX\_VALUE for 1, and consider the large space to be just a discretized domain
of fractions between 0 and 1.

This has the benefit of keeping the aggregation infrastructure generic and
avoids the need to “tag” different reports with whether they represent a
coarse-grained or fine-grained value.

In the end, we will use this MAX\_VALUE to scale noise via computing the
sensitivity of the computation, so submitting “1” for counts will yield more
noise than otherwise expected.

### Binary report format

A binary report format like CBOR could streamline AEAD authentication by passing
raw bytes directly to the reporting origin, which could be passed through
directly to an aggregation service. This design would avoid parsing /
serialization errors in constructing authenticated data necessary to decrypt the
payload.

However, binary formats are not as familiar to developers, so there is an
ergonomics tradeoff to be made here.
