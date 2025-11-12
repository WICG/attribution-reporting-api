**This technology is scheduled for deprecation.**

This repository will be archived and will no longer be updated.

See our [Update on Plans for Privacy Sandbox Technologies](https://privacysandbox.com/news/update-on-plans-for-privacy-sandbox-technologies/).

[Privacy Sandbox feature status](https://privacysandbox.google.com/overview/status) provides more information about the status of individual APIs and platform features.

---

# Attribution Reporting API

_The Attribution Reporting API supports measurement of clicks and views with event-level and aggregate reports._

_This repository hosts multiple technical explainers that specify various features of the API. This document offers an overview of the API and its explainers._

## Get started

This repository hosts detailed technical explainers.
Before diving into these, check out this [introductory article](https://developer.chrome.com/docs/privacy-sandbox/attribution-reporting).
If you're looking to experiment with the API, head over to this [guide](https://developer.chrome.com/docs/privacy-sandbox/attribution-reporting-experiment/).

All developer resources for this API are listed on [developer.chrome.com](https://developer.chrome.com/docs/privacy-sandbox/#measure-digital-ads).

## Participate

This API is being incubated and developed in the open. Here are ways to participate:

- [🗓 Join the bi-weekly meetings](https://github.com/WICG/conversion-measurement-api/issues/80) (every second week). In these calls, participants discuss API design proposals and how the API could support various measurement use cases. You can [add topics](https://docs.google.com/document/d/1zUSm9nX2nUsCa_fbI96UJoRCEr3eAPwWLU7HmClhIJk/edit) to the next meeting's agenda at any time. Everyone is welcome to join these discussions⏤only make sure to join the [WICG](https://www.w3.org/community/wicg/).

* [☝️ Open an issue](https://github.com/WICG/conversion-measurement-api/issues/new) to ask questions, propose features, or discuss use cases. If you're unsure how to formulate your issue, see examples like [this issue](https://github.com/WICG/conversion-measurement-api/issues/147) and [this issue](https://github.com/WICG/conversion-measurement-api/issues/68). You can also join the conversation in [existing issues](https://github.com/WICG/conversion-measurement-api/issues).

If you have **implementation** questions, for example about your **origin trial** in Chrome, [see how to get support](https://developer.chrome.com/docs/privacy-sandbox/attribution-reporting-experiment/#get-support). 

## Overview

The Attribution Reporting API makes it possible to measure when an ad click or view leads to a **conversion** on an advertiser site, such as a sale or a sign-up. The API doesn't rely on third-party cookies or mechanisms that can be used to identify individual users across sites.

The API enables two types of attribution reports:

* **Event-level reports** associate a particular event on the ad side (a click, view or touch) with coarse conversion data. To preserve user privacy, conversion-side data is coarse, and reports are noised and are not sent immediately. The number of conversions is also limited.
* **Aggregatable reports** provide a mechanism for rich metadata to be reported in aggregate, to better support use-cases such as campaign-level performance reporting or  conversion values.


These two report types can be used simultaneously. They're complementary.

## API features (proposals)

🕙 Last updated: Jan 2023

All the features below are proposals under incubation. This list evolves over time.

### Event-level reports (clicks and views)

Attribute cross-site click-through or view-through conversions with reports at a per-event level. 

See details in the [Explainer](https://github.com/WICG/conversion-measurement-api/blob/main/EVENT.md).

Implementation status: `Available in Chrome as an origin trial`

### Aggregatable reports (clicks and views)

Attribution reports for aggregated conversions (both clicks and views). Complements the event-level reports. 

See details in the [Explainer](https://github.com/WICG/conversion-measurement-api/blob/main/AGGREGATE.md).

Implementation status: `Available in Chrome as an origin trial`

### App-to-web (clicks and views)

Attribution reports for web conversions for ad clicks (touches) or views that occurred within an Android app. 

See details in the [web explainer](https://github.com/WICG/conversion-measurement-api/blob/main/app_to_web.md) and [Android explainer](https://developer.android.com/design-for-safety/privacy-sandbox/attribution-app-to-web).

Implementation status: `Expected in Chrome and Android for origin trial in Q2 2023`.

## External documentation

Chrome developer resources for the Aggregation Reporting API are available on [developer.chrome.com](https://developer.chrome.com/docs/privacy-sandbox/#measure-digital-ads).

Android has documentation on [developer.android.com](https://developer.android.com/design-for-safety/privacy-sandbox/attribution).
