# Attribution Reporting API

_The Attribution Reporting API supports measurement of clicks and views with event-level and aggregate reports._

_This repository hosts multiple technical explainers that specify various features of the API. This document offers an overview of the API and its explainers._

## Just getting started?

This repository hosts detailed technical explainers.
Before diving into these, check out these newcomer-friendly resources:

- For a quick overview of Attribution Reporting, head over to [Attribution Reporting in five minutes](https://developer.chrome.com/docs/privacy-sandbox/attribution-reporting-event-introduction/).
- For an in-depth introduction to the API's use cases, features, and privacy model, read [Introduction to Attribution Reporting](https://developer.chrome.com/docs/privacy-sandbox/attribution-reporting-introduction/).

These articles, as well as additional API guides and blogposts for this API, are listed [here](https://developer.chrome.com/docs/privacy-sandbox/attribution-reporting/).

## Participate

This API is being incubated and developed in the open. Here are ways to participate:

- [🗓 Join the bi-weekly meetings](https://github.com/WICG/conversion-measurement-api/issues/80) (every second week). In these calls, participants discuss API design proposals and how the API could support various measurement use cases. You can [add topics](https://docs.google.com/document/d/1zUSm9nX2nUsCa_fbI96UJoRCEr3eAPwWLU7HmClhIJk/edit) to the next meeting's agenda at any time. Everyone is welcome to join these discussions⏤only make sure to join the [WICG](https://www.w3.org/community/wicg/).

* [☝️ Open an issue](https://github.com/WICG/conversion-measurement-api/issues/new) to ask questions, propose features, or discuss use cases. If you're unsure how to formulate your issue, see examples like [this issue](https://github.com/WICG/conversion-measurement-api/issues/147) and [this issue](https://github.com/WICG/conversion-measurement-api/issues/68). You can also join the conversation in [existing issues](https://github.com/WICG/conversion-measurement-api/issues).

Note: If you have implementation questions, for example if you're running an **origin trial** in Chrome and have technical questions, join the [Attribution Reporting mailing list for developers](https://groups.google.com/u/1/a/chromium.org/g/attribution-reporting-api-dev) and ask your question. If you have general technical questions on your use case, consider opening an issue on the [Privacy Sandbox dev support repository](https://github.com/GoogleChromeLabs/privacy-sandbox-dev-support).

## Overview

The Attribution Reporting API makes it possible to measure when an ad click or view leads to a **conversion** on an advertiser site, such as a sale or a sign-up. The API doesn't rely on third-party cookies or mechanisms that can be used to identify individual users across sites.

The API enables two types of attribution reports:

* **Event-level reports** associate a particular event on the ad side (a click, view or touch) with coarse conversion data. To preserve user privacy, conversion-side data is coarse, and reports are noised and are not sent immediately. The number of conversions is also limited.
* **Aggregatable reports** provide a mechanism for rich metadata to be reported in aggregate, to better support use-cases such as campaign-level performance reporting or  conversion values.


These two report types can be used simultaneously. They're complementary.

## API features (proposals)

🕙 Last updated: January 2022

All the features below are proposals under incubation. This list evolves over time.

### Event-Level reports (clicks and views)

Attribute cross-site click-through or view-through conversions with reports at a per-event level. See details in the [Explainer: event-level reports](https://github.com/WICG/conversion-measurement-api/blob/main/EVENT.md).

Implementation status: `latest version not implemented yet, under development in Chrome`

### Aggregatable reports (clicks and views)

Attribution reports for aggregated conversions (both clicks and views). Complements the event-level reports. See details in the [Explainer](https://github.com/WICG/conversion-measurement-api/blob/main/AGGREGATE.md).

Implementation status: `Under development (Chrome)`

### App-to-web (clicks and views)

Attribution reports for web conversions for ad clicks (touches) or views that occurred within an Android app. See details in the [Explainer](https://github.com/WICG/conversion-measurement-api/blob/main/app_to_web.md).

Implementation status: `Proposal. Not implemented yet (all browsers)`

### Cross-device (clicks and views)

Attribute conversions occurring across distinct devices, i.e. as distinct web browser instances. See details in the [Explainer](https://github.com/WICG/conversion-measurement-api/blob/main/cross_device.md).

Implementation status: `Proposal. Not implemented yet (all browsers)`

## External Documentation
API guides and blogposts for this API are listed [here](https://developer.chrome.com/docs/privacy-sandbox/attribution-reporting/).