# Conversion Measurement with Aggregation Explainer

# Introduction

This document is an explainer for extensions to our existing [event-level conversion measurement API](https://github.com/csharrison/conversion-measurement-api) explainer. The intention is to provide mechanisms for information about conversions to be reported in a way that reporting endpoints can only learn _aggregate_ data, not any data associated with a particular click or user.
This is designed to work in along side our event-level conversion measurement API as they address different use cases.


In this way, we can satisfy use cases for which an event-level API would reveal too much private information.

This API builds on the mechanism described in the [Multi-browser aggregation service](SERVICE.md) explainer.

## Authors
- csharrison@chromium.org
- johnidel@chromium.org
- marianar@google.com

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Table of Contents

- [Goals](#goals)
    - [Richer conversion metadata](#richer-conversion-metadata)
    - [Better accuracy](#better-accuracy)
    - [View-through conversions](#view-through-conversions)
    - [Reports alongside event-level API](#reports-alongside-event-level-api)
    - [Fraud protection](#fraud-protection)
- [API Outline](#api-outline)
  - [Impression and conversion registration](#impression-and-conversion-registration)
  - [Final, private output](#final-private-output)
  - [API Extensions](#api-extensions)
    - [View-through conversions](#view-through-conversions-1)
    - [Multi-touch attribution (MTA)](#multi-touch-attribution-mta)
    - [Authenticating inputs](#authenticating-inputs)
    - [Many-per-click / Once-per-gclick](#many-per-click--once-per-click)
    - [Conversion filters](#conversion-filters)
    - [More complex queries](#more-complex-queries)
- [Privacy and security considerations](#privacy-and-security-considerations)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# Goals

The aggregate conversion measurement API should support legitimate measurement use cases not already supported by an event-level API.
It should do so in a privacy-safe manner as described [here](SERVICE.md#high-level-goals).

### Richer conversion metadata
The event-level API currently restricts the amount of conversion metadata, because it is linkable directly with click-level identifiers. The aggregate API could relax this constraint without compromising on privacy, and allow for richer metadata like reporting conversion value at the campaign level, something not currently possible with the event-level API. This richer metadata allows an advertiser to more accurately compute their return on investment, and for publishers to monetize their sites more effectively.

### Better accuracy
The aggregate conversion measurement API should give high-fidelity measurement of conversions. The reports it generates should produce more faithful results than, for example, the noisy conversion data in the event-level API.

In the event-level API, impressions are also limited to converting a small number of times. The aggregate conversion measurement API should allow advertisers to get more accurate counts of how many conversions there were for a campaign.

The accuracy of multi-touch modeling (many impressions for the same conversion) can also be improved. In the event-level API, multiple cross-site impressions targeting the same conversion cannot be associated together, making analysis based on the entire click “path” difficult (the event-level API only supports last-click attribution). This aggregate conversion measurement API should support more sophisticated multi-touch models, and potentially allow aggregate analytics for entire conversion paths.

### View-through conversions
There is a large class of impressions that are expected to be viewed but rarely clicked, for instance, pre-roll video ads. An aggregate conversion measurement API could be used to satisfy some of the measurement needs of these ads.

### Reports alongside event-level API

If the [privacy goals](SERVICE.md#high-level-goals) of the aggregation service are met, it means that we could extend the event-level API with this one, potentially sending parallel aggregate reports alongside event-level reports (as long as the reports are not otherwise associated with each other).

This greatly improves the usability of the API, allowing for many other use cases that aren’t possible with just the event-level scheme.


### Fraud protection

Aggregate conversion measurement is much more susceptible to fraud than event-level measurement. This is because by their nature, reports cannot be tied back to any browsing context that generated them, so they are easily forged or replayed without additional protection.

Our design should strive to provide strong fraud protections while still preserving privacy.


# API Outline

## Impression and conversion registration

The aggregate conversion measurement API surface should be a direct extension of the existing event-level design. At a basic level we want to add aggregatable data to impression and conversion registration. This means:

Impression `<a>` tags will get a new attribute that specifies some arbitrary string:
```
aggimpressiondata=”a=xyz,b=20”
```

Conversion reports will get two new query params:
```
agg-conversion-data=”type=purchase&conversion-value=123
```

Note: the conversion-value should be limited to some small-ish integer range, e.g. [0, 65535]. This is to better integrate with the aggregation multi-party protocol.

## Final, private output
This aggregate conversion measurement API uses the mechanics described in the [Multi-browser aggregation service explainer](SERVICE.md), which allows for aggregating these values across many different clients. Encrypted reports will be sent to the reporting endpoints (same as the event level API), but to get the final output, sites need to interact with server side infrastructure. After that, they should be able to recover the following information:

```
<KeyID>: {
  key: <aggimpressiondata || agg-conversion-data>,
  count: <sum(count)>,
  count_noise: {
    distribution: “laplace”,
    std: <num>
  }
  value: <sum(conversion-value)>,
  value_noise: {
    distribution: “laplace”,
    std: <num>
  }
}
```

Note: to maintain privacy and avoid temporally joining these encrypted reports with specific conversion events, we will likely need to add some delay before these get sent out. This delay will not necessarily need to be as long as the delay specified in the event-level API though.

## API Extensions

### View-through conversions

The aggregate conversion measurement API can be easily extended to support view-through conversions. Simply add a new attribute impressionviewed to the `<a>` tag to register an impression without a click. If the impression later gets clicked, it will be “upgraded” to a click behind the scenes. To differentiate between views and clicks in the output, you need to mark the impression’s metadata appropriately (e.g. in the `<a>` tag click handler).

Many advertisers use different notions of “viewability”, so it is important to support setting this attribute dynamically.

Note that currently the event level API does not support view-through conversions, so viewed conversions will only send aggregate reports for now. (Note that we are actively exploring ideas to support view conversions in the event-level API too).

### Multi-touch attribution (MTA)

Multi-touch attribution is the method in which multiple impressions leading up to a conversion are assigned credit. The event-level API currently only supports a “last-clicked” attribution model, where the last clicked impression received a credit of “100” and the impressions preceding it received a credit of “0”. However, supporting arbitrary rules-based models in a privacy preserving way is difficult in the event-level approach, since the credit associated with each conversion can leak more cross-site activity. These problems are mitigated with aggregation and differential privacy, so we can extend support for these other models here.

This can be achieved by annotating the conversion registration URL with a new parameter:
```
agg-multi-touch-model=<linear,last-clicked,first-clicked,...>
```

Based on the model, at conversion time, locally in the browser, each impression in the path is annotated with a credit from 0 to 100, such that they all sum up to 100. These credits are aggregated in the final output, so the sum of the credit is reported rather than the total count.

It may be possible to extend this idea to support more sophisticated models if they can be implemented in some isolated Javascript user-space worklet rather than in the browser engine, though care must be taken to avoid leaking data across sites. Additionally, we are exploring MTA techniques even more sophisticated than rules-based models (e.g. ones that might need entire paths from groups of users). This is an active research project for us.

### Authenticating inputs

With cookies and event level data, it is easy to authenticate impression and conversion data and throw out pings that come from bad clients. Every record can in principle be traced back to a particular client/device and its associated actions and reputation.

In a model where anonymous reports are sent for aggregation, it is not difficult for adversaries to generate fake records that are indistinguishable from real records. To combat this, we can allow data created from impression and conversion registration to be signed via some external endpoint. These signatures can be verified later on by the helper servers in a privacy safe way.

Impressions can declare authentication servers by attaching a new attribute:
```
impressionsigningurl=<URL>
```

Conversions can declare authentication servers by adding a new URL param to registration:
```
conversion-signing-url=<URL>
```

Once an impression / conversion is registered, the browser should interact with the signing endpoint, which should provide authentication tokens that will attach to conversion reports and be verified by the helper servers. Helper servers can (optionally) discard reports that are not signed. This is explored in more detail [here](SERVICE.md#authenticating-inputs).

### Many-per-click / Once-per-click

The event-level API allows up to 3 conversions per click, and subsequent ones are dropped. It is reasonable to support at least this number in the aggregate API as well.

We also propose some new functionality “once-per-click” (OPC), that allows conversions to be dropped if they are duplicate. We’ll modify the conversion redirect to accept an extra param:
```
local-dedupe-key=<key>
```

The dedupe key is stored in the browser alongside the conversion. When this is set, the browser will ignore all future conversions (for the matching impression) that have the exact same dedupe key. Note that the dedupe key is never reported to the aggregation servers, it is just used to drop conversions.

Since this feature strictly reduces the amount of information sent out by the browser, it should not affect any differential privacy guarantees enforced by an aggregation service.

### Conversion filters

Another technique to filter reports besides once-per-click dedupe keys (and that addresses a different use-case) would be to specify a more complex filter at impression time. This filter would provide a means to avoid attribution for impressions that don’t match specific conversions. For instance, a merchant might only be interested in reporting conversions for purchases that matched a given ad campaign (i.e. don’t attribute the “shoe ad” to the “coat purchase”). See [this issue](https://github.com/WICG/conversion-measurement-api/issues/32) for more context.

Like mentioned in the [multi-touch](#multi-touch-attribution-mta) section, an isolated Javascript environment (that cannot leak cross-site impressions to the advertiser page) could be a nice solution here, i.e. one that executed arbitrary functions that allowed for dropping reports from aggregation. Some simpler matching function could work as well (the linked issue mentions a few ideas).

Note: some of the functionality of filters could be implemented with more complicated queries to the helpers, but dropping reports before they are sent improves conversion bandwidth / storage and also prevents the report from contributing to any user contribution rate limiting.

### More complex queries
We should be able to support more complex queries than just those using a fixed aggregation key. This is explored in more detail [Grouping multiple keys in one query](SERVICE.md#Grouping-multiple-keys-in-one-query).


# Privacy and security considerations
This API extends the event level conversion measurement API substantially by integrating it with an aggregation service. This introduces new security and privacy considerations that are explored in more detail [aggregation service explainer](SERVICE.md#privacy-considerations).