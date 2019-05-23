Conversion Measurement
======================

This document is an explainer for a potential new web platform feature which allows for measuring and reporting ad click conversions.

(Name probably needs bikeshedding)

Glossary
--------

-   **Publisher**: Page that shows ads, sells ad slots

-   **Advertiser**: Purchaser of ad slots, conversions happen on advertiser sites

-   **Impression**: View of an ad

-   **Conversion**: The completion of a meaningful (advertiser specified) user action on the advertiser's web site by a user who has previously interacted with an ad from that advertiser.

-   **Event-level data**: Data that can be tied back to a specific low-level event; not aggregated

-   **Click-through-conversion (CTC)**: A conversion due to an impression that was clicked

Motivation
----------

Currently, the web ad industry measures conversions via identifiers they can associate across sites. These identifiers tie information about which ads were clicked to information about activity on the advertiser's site (the conversion). This allows advertisers to measure ROI, and for the entire ads ecosystem to understand how well ads perform.

Since the ads industry today uses common identifiers across advertiser and publisher sites to track conversions, these common identifiers can be used to enable other forms of cross-site tracking.

This doesn’t have to be the case, though. A new API surface can be added to the web platforms to satisfy this use-case without propagating user identifiers. This would introduce a new privacy preserving way to ensure cross-site measurement coverage even in cases where cross-site user identifiers are unavailable or undesirable.

Prior Art
---------

Webkit has published a [draft spec](https://trac.webkit.org/wiki/ad-click-attribution-draft-spec) on Ad Click Attribution for the Web.

Brave has published and implemented an [Ads Confirmation Protocol](https://github.com/brave/brave-browser/wiki/Security-and-privacy-model-for-ad-confirmations).

Brief Strawman Idea
-------------------

The structure of the proposal is very similar to Webkit’s Ad Click Attribution model, with a few differences.

We can introduce new attributes on an `<a>` tag that identifies a link as an ad impression along with some associated metadata about the impression. Each impression targets an advertiser site where a conversion will take place. When a link is clicked, the metadata declared on the impression can be persisted to a new storage area.

When the advertiser associated with the creative wishes to log a conversion, they can issue a special HTTP request to some `.well-known` address (e.g. via an `<img>` tag on their page), which the browser can recognize, and impressions associated with the advertiser will be marked “converted” internally and queued for reporting. Query params can be used to associate additional metadata to the conversion.

After an artificial and variable delay (e.g. 24-48 hours), the browser will generate a JSON report for each converted impression and POST it (without credentials) to a configured reporting endpoint, along with associated impression and conversion metadata.

### Configuring Reporting Endpoints

The API allows for third parties to receive conversion reports on behalf of the publisher and advertiser.

The publisher and advertiser should agree on where reports get sent. On the publisher page, ad impressions can annotate their `<a>` tags with a reporting origin they want to delegate reports to. On the advertiser page, the advertiser can choose where they go via the origin of the `.well-known` HTTP request.

Integrating with the [Reporting API](https://w3c.github.io/reporting/) would be a nice bonus to enhance flexibility. One way this could work is by the reporting origin optionally using the Report-To header so reports go to endpoints specified there rather than e.g. a default `.well-known` address.

### Browser control of information

This strawman API has a few nice properties:

-   Impression / conversion information storage is write-only and can only be updated once

-   The only way cross-site information is exposed is in the final report, which is in full browser control, and is sent without any credentials, disassociated from the publisher and advertiser pages.

-   The browser is in control of the structure of impression / conversion information.

This control allows the browser to place explicit limits on what information can be shared. There are a lot of different possible techniques for controlling the information channel:

-   Limiting the number of bits of data on either end of the report.

-   Adding noise to metadata on either end using local differential privacy techniques like [RAPPOR](https://github.com/google/rappor).

-   Utilizing some form of trusted aggregation service to ensure report data reaches aggregation thresholds and is not identifying, as a gating mechanism before sending a report.

-   The browser could opt to send multiple parallel reports for any one conversion event, where each report type sends a different kind of data. Care would need to be taken to avoid linking reports to each other though (temporally or otherwise).

The controls imposed on reports need to make explicit trade-offs between privacy and utility.

API Design Goals
----------------

### Privacy

Any conversion measurement API will be built around joining impression level information with conversion information. If this information channel is not carefully controlled, this API could be used to share identity across sites. To maintain good privacy, we need to ensure that the information in a report does not reveal much more information about a given user than the publisher / advertiser already knew without the API (i.e. the unjoined data).

Since the browser has control over this channel, limits can be tuned to give good privacy and utility.

### First party and third party ads

Ideally, this API should be able to support conversion measurement on ads in first party and third party contexts. The vast majority of the web advertising ecosystem relies on third parties for their ads, and ideally a solution would accommodate them.

Restricting to first party ads could lead to perverse incentives for third parties to opt-out of isolating themselves using primitives like cross-domain iframes.

### Few site updates

Ideally, most publishers and advertisers will not need to update their sites much to take advantage of this API. Ad tech providers and ad creative authors can change their code to do it under the hood.

Lots of conversion tags today rely on `<img>` "pixels", so a conversion registration mechanism that relied on Javascript would force advertisers to make updates. Additionally, nearly all ad tech companies fall back to `<img>` tags if Javascript is disabled, or partner with existing publishers using legacy `<img>` tags.

Examples: [Google](https://support.google.com/admanager/answer/2499318), [Appnexus](https://wiki.appnexus.com/display/api/Conversion+Pixel+Service), [Facebook](https://developers.facebook.com/docs/facebook-pixel/implementation#base-code).

### Declarative / Non-script based

All else being equal, it is beneficial to avoid the need for more third-party Javascript running on pages.

### Event-level impression metadata

Event-level data is data that identifies a single unique event, as opposed to aggregated data. This kind of data is essential for training machine learning models used to optimize ad selection, since success / failure needs to propagate to the individual inference that chose the ad in the first place.

Event level impression data is also useful to filter out fraudulent clicks. With coarser impression data, fraudsters can more easily hide in the crowd.

If full fidelity impression data is not available, these key use-cases are much harder to achieve.

### Some conversion metadata

Here are some legitimate use cases of conversion metadata:

-   Conversion label (sign-up vs purchase)

-   Conversion value ($10 purchase vs. $1000 purchase)

-   Conversion delay (conversion time – impression time)

-   Lifetime value (sum of all purchase values for a given user)

-   Conversion basket (the list of items and quantity purchased)

-   New / existing customer (whether the customer was existing or new, for the purpose of optimizing for customer acquisition)

Some of these use-cases may not be supported by this API, depending on their informational needs.

### Third party reporting

Most publishers and advertisers do not have the server-side infrastructure required to log and measure conversions. Instead, they have third party ad tech companies do it for them. For a conversion API to be broadly used, it should allow for this use-case.

This goal is purely for ergonomics. It shouldn’t change the underlying privacy properties of the API assuming publishers / advertisers would forward reports to their ad tech companies anyway on the server-side.

Of course, it should not be possible for untrusted third parties to receive conversion reports without publisher / advertiser permission.

Open problems / Edge cases
--------------------------

### Multiple impressions convert

If multiple impressions on different publishers convert for the same conversion event, it can be confusing to tell after the fact what happened. Is this a "multi-touch" conversion in which many ads led to one conversion for a single user, or multiple separate conversions from different users? Existing attribution strategies (e.g. [AdWords](https://support.google.com/google-ads/answer/6259715)) try to give variable "credit" to each impression that led to a conversion.

This is a hard problem to solve while still preserving privacy, since the amount of credit any given impression receives could leak cross-publisher information. There may be interesting solutions here using techniques like adding noise to the credit value, or enforcing aggregation thresholds with server side infrastructure.

Solutions to this problem may also need to include protections against false reports, especially in cases where an attacker has the power to drop older reports in favor of new, fake ones.

### Multiple conversions per impression

If a single impression causes multiple conversions, the current API sketch does not allow for subsequent conversions to receive any information. This is by design, since allowing arbitrarily many reports could allow a malicious advertiser to spam ${user-id} number of conversions, allowing identity joining.

It may be possible to relax strict limits on the number of times an impression can convert, but it must be weighed against the privacy tradeoffs of providing that additional signal. Possibly, for subsequent conversion reports for already-converted impressions, we can afford to make metadata coarser.

### Multiple reporters

An advertiser may want to send duplicate reports to multiple reporting partners that may not mutually trust each other. This is very tricky to get right without revealing any extra information. Allowing different conversion metadata for different reporting endpoints makes things even more difficult.

This problem becomes a bit easier if reporting partners mutually trust each other, or there are some trusted reporters that can fan-out reports to others

### Recovering identity with many conversions

If we aren’t careful, a publisher could join identity with an advertiser across many conversions, as long as the user keeps clicking on impressions.

There are a few possible ways to mitigate this, including introducing exponential delay in reports for (publisher, advertiser) pairs, as well as using techniques like randomized response which could involve spuriously “converting” impressions to add plausible deniability, or adding noise to conversion metadata itself.

### Concrete impression / conversion metadata restrictions

The brief design leaves open how exactly metadata should be restricted. We will need to do some research to figure out the best restrictions to impose that provide both privacy and utility.

### Non-click conversions

There are use-cases for conversion measurement that don’t come associated with an ad click. A few notable examples:

-   In-stream video ads, which rarely are clicked, since a click would interrupt the main video content.

-   Measuring conversions for the *absence* of an impression, for things like ablation A/B experiments. This functionality is critical for measuring campaign effectiveness accurately.

-   Brand ads, where the ad does not expect a direct response like a click, but may want to measure the affect the ad had on subsequent surveys shown to the user. Attributing an ad impression to a survey result isn’t really a “conversion”, so perhaps we may want to bikeshed the name for this a bit more. The survey use-case intersects a lot with the “counterfactual” A/B experiments mentioned above.

These types of conversion do not have associated user intent like a click, so it might be wise to treat them separately and enforce stricter limits on what data they can report.

### Fraud

Depending on the information contained in any conversion report, it may be difficult for reporting origins to differentiate real and fraudulent traffic.
