# Measuring Cross Device Attribution

## Authors:

*   Charlie Harrison
*   John Delaney

## Introduction

Currently, the [Attribution Reporting API](https://github.com/WICG/conversion-measurement-api) (classically referred to as the Conversion Measurement API) supports attributing events on a single device, within a single browser instance. With this proposal, browsers that support a “sign-in” feature can allow attribution across all the user’s devices, as if they had a unified storage.


## Goals

Allow attributing events across multiple devices operated by the same person. This gives advertisers a clearer picture of how their ads actually lead to conversions and is an important use-case that is satisfied when third party cookies are available.


## Non-goals

This proposal does not attempt to support attribution across devices that span multiple identity providers (including multiple browser vendors that have differing sign-in mechanisms)

## API changes


### Opting-in to cross-device attribution

*   On attribution sources, a new anchor element attribute `crossdevice` will tag the source as eligible for cross device attribution.
*   On attribution triggers, a new query param `cross-device={0,1}` will tag the trigger as eligible for cross device attribution.

Events that are eligible for cross device attribution will be broadcast to all the connected devices, or synchronized in some way such that all the devices will have a unified view.


### Reporting whether attribution occurred cross device

*   For [event-level data](https://github.com/WICG/conversion-measurement-api/blob/main/event_attribution_reporting_clicks.md), a new boolean will be added to JSON reports: `cross_device`
*   For [aggregate data](https://github.com/WICG/conversion-measurement-api/blob/master/AGGREGATE.md), we expect to add a mechanism to allow this bit (or something similar) to be present on aggregation keys. For example, this is something that could be integrated easily into the “worklet” technique (see [issue](https://github.com/WICG/conversion-measurement-api/issues/114)).


## Key scenario

*   Person A sees a shoe ad on their phone, clicks it
*   Because the ad has enabled the `crossdevice` attribute in the API, the click is registered and broadcast to their other devices
*   Later on, A purchases the shoes on their desktop computer
*   Because the original click was broadcast to the desktop, the API can attribute the original ad click and the purchase together

## Privacy considerations

### Browser-facilitated unified storage

There are a number of possible implementations for how the browsers could facilitate unified storage. These decisions have important privacy considerations.

**End-to-end encrypted channel**

The browser’s sign-in mechanism could facilitate a public key exchange between all the devices a person signs into. All attribution messages can be broadcast in an end-to-end encrypted fashion so no server-side infrastructure can read messages.

This is similar to how Chrome implements sharing phone numbers and text between devices signed into the browser. See [this section](https://www.google.com/chrome/privacy/whitepaper.html#signin) of the Chrome privacy whitepaper for more information.

**Server-side storage, encrypted at rest**

The browser can maintain event-storage (attribution sources / triggers) in some server-side infrastructure, so that all clients can download events and have a unified view. This has a much simpler architecture than using an e2e encrypted channel, but care must be taken to ensure that the browser vendor has minimized visibility into the raw data.

### Extra data surfaced in the API

In terms of extra information sent in the API, we are sending a `cross_device` boolean in the event-level API which reveals more information about a user’s browsing activity. While this information could include noise, for this proposal noise isn’t added. This is because the bit is controlled by the browser (not directly by a third party setting the bit, as the `crossdevice` attribute only marks an attribution as _eligible_), and the information revealed, while possibly sensitive, may be mitigated by an appropriate user surface.


## Considered alternatives

There is an [alternative proposal](https://github.com/w3c/web-advertising/blob/main/enabling-browsers-that-belong-to-the-same-person-to-discover-one-another.md) in the Web Advertising Business Group which enables third party identity providers to facilitate a key exchange to similarly implement an end-to-end encrypted channel to send messages between devices.

There are a few big challenges with this proposal:
*   There is a lot of complexity, with multiple rounds of interaction to facilitate the key exchange
*   If any two identity providers collude and falsely log the user in, they can read all the users attribution messages in the clear

This proposal is interesting, and an ecosystem-defined device graph is definitely valuable. However, having the identity provider be the browser is simpler, and makes it easier for browser vendors to ensure sensitive user data is not leaked.


## References & acknowledgements

* Ben Savage from Facebook had a [proposal](https://github.com/w3c/web-advertising/blob/main/cross-browser-anonymous-conversion-reporting.md) which inspired this one, also described in the [considered alternatives](#considered-alternatives) section.
