# Attribution Reporting API

_This document is an overview of the Attribution Reporting API proposal. The API supports measurement of clicks and views with event-level and aggregate reports.. If you're looking specifically for the explainer for event-level click reports that used to live on this page, head over to [Attribution Reporting for Click-Through Measurement](https://github.com/WICG/conversion-measurement-api/blob/main/event_attribution_reporting_clicks.md) instead._

## Participate

This API is being incubated and developed in the open. Here are ways to participate:

- [🗓 Join the bi-weekly meetings](https://github.com/WICG/conversion-measurement-api/issues/80) (every second week). In these calls, participants discuss API design proposals and how the API could support various measurement use cases. You can [add topics](https://docs.google.com/document/d/1zUSm9nX2nUsCa_fbI96UJoRCEr3eAPwWLU7HmClhIJk/edit) to the next meeting's agenda at any time. Everyone is welcome to join these discussions⏤only make sure to join the [WICG](https://www.w3.org/community/wicg/).

* [☝️ Open an issue](https://github.com/WICG/conversion-measurement-api/issues/new) to ask questions, propose features, or discuss use cases. If you're unsure how to formulate your issue, see examples like [this issue](https://github.com/WICG/conversion-measurement-api/issues/147) and [this issue](https://github.com/WICG/conversion-measurement-api/issues/68). You can also join the conversation in [existing issues](https://github.com/WICG/conversion-measurement-api/issues).

Note: If you have implementation questions, for example if you're running an **origin trial** in Chrome and have technical questions, join the [Attribution Reporting mailing list for developers](https://groups.google.com/u/1/a/chromium.org/g/attribution-reporting-api-dev) and ask your question. If you have general technical questions on your use case, consider opening an issue on the [Privacy Sandbox dev support repository](https://github.com/GoogleChromeLabs/privacy-sandbox-dev-support).

## Overview

The Attribution Reporting API makes it possible to measure when an ad click or view leads to a **conversion** on an advertiser site, such as a sale or a sign-up. The API doesn't rely on third-party cookies or mechanisms that can be used to identify individual users across sites.

The API enables two types of attribution reports:

- **Event-level reports** associate a particular event on the ad side (a click, view or touch) with coarse conversion data. To preserve user privacy, conversion-side data is coarse and noised, reports are not sent immediately, and the number of conversions is limited.
- **Aggregate reports** are not tied with a specific event on the ad side. These reports provide richer, higher-fidelity conversion data than event-level reports. A combination of privacy techniques across cryptography, distribution of trust, and differential privacy help reduce the risk of identity joining across sites.
  Both report types can be used simultaneously. They're complementary.

## API features (proposals)

🕙 Last updated: June 2021

All the features below are proposals under incubation. This list evolves over time.

### Event-Level reports (clicks and views)

Attribute cross-site click-through or view-through conversions with reports at a per-event level. See details in the [Explainer: event-level reports for views](https://github.com/WICG/conversion-measurement-api/blob/main/event_attribution_reporting_views.md) and in the [Explainer: event-level reports for clicks](https://github.com/WICG/conversion-measurement-api/blob/main/event_attribution_reporting_clicks.md).

Implementation status:

Click-through: `🟢 available for experimentation in Chrome`. See the [origin trial](https://developer.chrome.com/origintrials/#/view_trial/3411476717733150721).

View-through: `🟤 not implemented yet (all browsers)`

### Aggregate reports (clicks and views)

Attribution reports for aggregated conversions (both clicks and views). Complements the event-level reports. See details in the [Explainer](https://github.com/WICG/conversion-measurement-api/blob/main/AGGREGATE.md).

Implementation status: `🟤 not implemented yet (all browsers)`

### App-to-web (clicks and views)

Attribution reports for web conversions for ad clicks (touches) or views that occurred within an Android app. See details in the [Explainer](https://github.com/WICG/conversion-measurement-api/blob/main/app_to_web.md).

Implementation status: `🟤 not implemented yet (all browsers)`

### Cross-device (clicks and views)

Attribute conversions occurring across distinct devices, i.e. as distinct web browser instances. See details in the [Explainer](https://github.com/WICG/conversion-measurement-api/blob/main/cross_device.md).

Implementation status: `🟤 not implemented yet (all browsers)`

## External Documentation
- [API overview](https://developer.chrome.com/docs/privacy-sandbox/attribution-reporting/)

- [API guide](https://web.dev/conversion-measurement) // ⚠️ only valid for the first iteration of the API (event-level, clicks only)
- [Experiment (origin trial) guide](https://web.dev/using-conversion-measurement/) // ⚠️ only valid for the first iteration of the API (event-level, clicks only)
- [Demo](https://goo.gle/demo-attribution-reporting) // ⚠️ only demos the first iteration of the API (event-level, clicks only)
