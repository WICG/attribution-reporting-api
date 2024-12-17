# Aggregate Debug Reporting

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

- [Authors](#authors)
- [Introduction](#introduction)
- [API changes](#api-changes)
  - [Opting-in aggregate debug reporting](#opting-in-aggregate-debug-reporting)
  - [Aggregatable debug reports](#aggregatable-debug-reports)
    - [Encrypted payload](#encrypted-payload)
- [Privacy and Security](#privacy-and-security)
  - [Contribution bounding and budgeting](#contribution-bounding-and-budgeting)
  - [Make count of reports deterministic with null reports](#make-count-of-reports-deterministic-with-null-reports)
  - [Rate limits](#rate-limits)
  - [No reporting delay](#no-reporting-delay)
- [Future considerations](#future-considerations)
  - [Report verification with debug context ID](#report-verification-with-debug-context-id)
  - [Application to aggregate error reporting for the Private Aggregation API](#application-to-aggregate-error-reporting-for-the-private-aggregation-api)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Authors

* John Delaney (johnidel@chromium.org)
* Arpana Hosabettu (arpanah@chromium.org)
* Nan Lin (linnan@chromium.org)

## Introduction

The [transitional debugging reports](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#optional-transitional-debugging-reports),
which are currently supported by the Attribution Reporting API to facilitate
testing, will be deprecated alongside third-party cookie deprecation.

Here we propose the aggregate debug reporting framework to allow developers to
measure the performance of the Attribution Reporting API post third-party
cookie deprecation. The aggregate debug reporting utilizes the mechanism
introduced in the [Aggregate Attribution Reporting](https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md)
to report debug data in aggregate. To prevent leakage, the cross-site data in
the aggregatable reports would be encrypted to ensure it can only be processed
by the [aggregation service](https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATION_SERVICE_TEE.md).
During processing, this service will add noise and impose limits on how many
queries can be performed.

## API changes

### Opting-in aggregate debug reporting

The [source registration](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#registering-attribution-sources)
and [trigger registration](https://github.com/WICG/attribution-reporting-api/blob/main/EVENT.md#triggering-attribution)
will accept an optional dictionary field:

```jsonc
{
  ..., // existing fields

  "aggregatable_debug_reporting": {
    "budget": 1024, // required for sources, irrelevant for triggers
    "key_piece": "0x120", // required, source- or trigger-side key piece
    "debug_data": [    
      {  
        "types": ["source-destination-limit", "source-destination-rate-limit"], // required to be present and non-empty
        "key_piece": "0x1", // required
        "value": 123 // required
      },
      {  
        "types": ["unspecified"],
        "key_piece": "0x7",
        "value": 789
       }
    ], // defaults to [], i.e. doesn't opt-in to any debug types 
    "aggregation_coordinator_origin": "https://publickeyservice.msmt.aws.privacysandboxservices.com" // defaults to implementation-defined default origin
  }
}
```

The source registration can pre-allocate `budget` from the total L1 budget
(L1 = 65536) for debug reporting, and the remaining will be used for aggregate
attribution reporting.

The configuration accepts an optional list field `debug_data` to allow
developers to specify the aggregation key piece as a hex-string and the
corresponding histogram value for debug types they opt-in to receiving.
When the `unspecified` value is set, any non-explicitly specified debug
types will be reported with the corresponding key piece and value; otherwise
they will not be reported. The list of supported debug types will be documented
in the [specification](https://wicg.github.io/attribution-reporting-api/#attribution-debug-data).

The configuration also accepts an optional string field
`aggregation_coordinator_origin` to allow developers to specify the deployment
option for the aggregation service supported by the browser. This defaults to
the implementation-defined default origin if omitted.

The final histogram bucket key is defined as a combination (bitwise OR) of the
source-side key piece if available, the trigger-side key piece if available,
and the key piece for the corresponding debug type.

Final keys will be restricted to a maximum of 128 bits. This means that hex
strings in the JSON must be limited to at most 32 digits.

Note: Aggregate debug reporting is not supported for registrations inside a
fenced frame tree to avoid breaking the privacy model of fenced frames.

### Aggregatable debug reports 

Aggregatable debug reports will look very similar to
[aggregatable attribution reports](https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md#aggregatable-reports).
They will be reported via HTTP `POST` to the reporting origin at the path
`.well-known/attribution-reporting/debug/report-aggregate-debug`.

The report itself does not contain histogram contributions in the clear. Rather,
the report embeds them in an _encrypted payload_ that can only be read by a
trusted aggregation service known to the browser. The report will be
JSON-encoded with the following schema:

```jsonc
{
  // Info that the aggregation services also need encoded in JSON
  // for use with AEAD.
  "shared_info": "{\"api\":\"attribution-reporting-debug\",\"attribution_destination\":\"https://advertiser.example\",\"report_id\":\"[UUID]\",\"reporting_origin\":\"https://reporter.example\",\"scheduled_report_time\":\"[timestamp in seconds]\",\"version\":\"[api version]\"}",

  // Supports a list of payloads for future extensibility if multiple coordinators
  // are necessary. Currently only supports a single coordinator.
  "aggregation_service_payloads": [
    {
      "payload": "[base64-encoded HPKE encrypted data readable only by the aggregation service]",
      "key_id": "[string identifying public key used to encrypt payload]",
    },
  ],

  // The deployment option for the aggregation service.
  "aggregation_coordinator_origin": "https://publickeyservice.msmt.aws.privacysandboxservices.com"
}
```

Note: If the source registration specifies a list of destinations, the first
one in lexicographical order will be used for debug reporting.

#### Encrypted payload

The `payload` should be a [CBOR](https://cbor.io) map encrypted via
[HPKE](https://datatracker.ietf.org/doc/draft-irtf-cfrg-hpke/) and then base64-
encoded. The map will have the following structure:

```cbor
{
  "operation": "histogram",  // Allows for the service to support other operations in the future
  "data": [{
    "bucket": <bucket, encoded as a 16-byte (i.e. 128-bit) big-endian bytestring>,
    "value": <value, encoded as a 4-byte (i.e. 32-bit) big-endian bytestring> 
  }, ...]
}
```

The browser may encode multiple contributions in the same payload. To avoid
revealing the number of contributions in the payload through its encrypted size,
the browser should pad the list of payloads with null (zero value)
contributions up to the maximum, which is 2 for aggregatable debug reports.

## Privacy and Security
 
### Contribution bounding and budgeting

We bound the contributions any source can make to a histogram. This bound is
characterized by a single parameter: L1, the maximum sum of the contributions
(values) across all buckets for a given source, including aggregate attribution
reporting and debug reporting. L1 refers to the L1 sensitivity / norm of the
histogram contributions per source. The budget for debug reporting is
pre-allocated at source registration time, and exceeding the budget will cause
future contributions to silently drop.

The aggregation service will add noise to the summary reports to achieve
differential privacy, e.g. by using Laplace noise scaled based on the L1
sensitivity and a desired privacy parameter epsilon. The effective epsilon
needs to be scaled based on the budget allocated for debug reporting.

Note: The L1 budget (65536) is shared between the aggregatable attribution
reports and the aggregatable debug reports that are associated with the same
source registration.

### Make count of reports deterministic with null reports

To fully protect the total count of debug reports, the browser will
unconditionally send a report on every attribution registration that opts-in to
aggregate debug reporting. A null report will be sent in the case that the
attribution registration did not generate an aggregatable debug report. Null
reports will not check or affect rate limits.

To reduce complexity, the source registration time will always be excluded from
the aggregatable debug reports.

Additionally, this proposal also prevents attackers from inferring user data
from the generated debug reports.

Note: If the reporting origins are concerned about the potentially large number
of reports, they may consider opting-in to aggregate debug reporting with
sampling on a per advertiser basis for debugging and monitoring.

### Rate limits 

To limit the amount of user-identity leakage, the browser should throttle the 
amount of total information sent through this API in a given time period for a
user. The browser could bound the contributions that any
<top-level site, reporting site> tuple can make to the histogram within a
rolling time window. If this threshold is hit, the browser will stop scheduling
aggregatable debug reports for the rest of the time period for attribution
registrations matching that tuple.

Strawman: L1 bound of 65536 per <top-level site, reporting site> per day.

Additionally, to mitigate the attack in which multiple reporting sites collude
with each other to infer user data from the debug reports, the browser can also
bound the contributions that any top-level site can make to the histogram
within a rolling time window.

Strawman: L1 bound of 2<sup>20</sup> = 1048576 per top-level site per day.

There will also be a maximum limit of 5 aggregatable debug reports per source
to limit the cross-site leakage on a per-source level.

### No reporting delay

As the count of reports is deterministic with the introduction of null reports
and the report does not contain cross-site data in the clear, there is no
privacy concern with sending these reports immediately without delay.

## Future considerations 

### Report verification with debug context ID

We may consider allowing source and trigger registrations to specify a
high-entropy debug context ID for aggregate debug reporting, which will be
embedded unencrypted in the aggregatable debug report. This would uniquely tie
every aggregatable debug report to the source or trigger context that generated
it. Because the IDs are high entropy (and thus difficult to guess), they could
serve the purpose of anonymous tokens.

This design is aligned with the [trigger context ID proposal](https://github.com/WICG/attribution-reporting-api/blob/main/AGGREGATE.md#optional-reduce-report-delay-with-trigger-context-id)
in aggregate attribution reporting.

### Application to aggregate error reporting for the Private Aggregation API

The aggregate debug reporting mechanism should be extendable to [aggregate error reporting](https://github.com/patcg-individual-drafts/private-aggregation-api#aggregate-error-reporting)
for the Private Aggregation API.

The details of the approach will be explored in a separate GitHub issue.
