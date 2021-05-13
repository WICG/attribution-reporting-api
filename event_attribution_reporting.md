# Event Attribution Reporting API Explainer


## Authors:

* John Delaney
* Charlie Harrison


## Participate
https://github.com/WICG/conversion-measurement-api/issues


## Introduction

Currently, the Attribution Reporting API (classically referred to as the Conversion Measurement API) allows for event level measurement of ad conversions when the user clicked on an ad and visited an advertiser site. This proposal allows for event level measurement of ads which the user did not click on and visit the advertiser site, also sometimes called “view through conversions”. This proposal introduces more restrictive privacy mechanisms in the API to account for this more generic capability.

The additional restrictions in this proposal represent one potential privacy vs. utility tradeoff, and may be adjusted to provide more utility or privacy.

This proposal should be read as an optional additive component to the Click Through Attribution Reporting API.


## API Changes

### Registering attribution sources without a click

Anchor elements will expose a new boolean `registerattributionsource` attribute which when added to the tag, registers an attribution source event similar to when an attribution source anchor tag is clicked.


### Registering attribution sources with JavaScript

Scripts running on a source site can register attribution sources via a new JavaScript API without needing to add anchor elements to the page.

The browser will expose a new interface:

```
[Exposed=Window] interface Attribution {
  boolean registerAttributionSource(AttributionSourceParams params);
};
```

`AttributionSourceParams` is a dictionary which contains the same attributes used by attribution source anchor tags:

```
dictionary AttributionSourceParams {
  required DOMString attributionSourceEventId;
  required USVString attributionDestination;
  USVString attributionReportTo;
  unsigned long attributionExpiry;
};
```

When invoked the browser will directly add the specified source to storage, and return whether the browser was successful in parsing the params.


### Different Classes of Attribution Sources

Attribution sources will have a browser associated `source_type`. Attribution sources registered with the `registerattributionsource` attribute or via the JS API  will have source_type set to "event". Sources registered via clicks on anchor tags or with the `window.open()` API will have `source_type` set to "navigation".


### Attribution Triggering

Attribution trigger redirects will be able to specify different data to be used, depending on the `source_type` of any associated sources.

This is done via a new query param, `event-source-trigger-data` on the trigger [redirect](https://github.com/WICG/conversion-measurement-api#triggering-attribution). This data will be limited to 1 bit. This data will be noised 5% of the time, matching the [noise](https://github.com/WICG/conversion-measurement-api#data-limits-and-noise) for navigation sources.

Event sources will only be able to generate a single attribution report, compared to the three reports for navigation sources. Alongside the 1 bit of data, this further restricts the total amount of trigger side data which can be associated with a single `attributionsourceeventid`. See [privacy considerations](#privacy-considerations) for why this is necessary.


### Coarse Attribution Expiry

Event sources will have their `attributionexpiry` rounded to the nearest whole day.

The `attributionexpiry` of a source can be used to associate `attributionsourceeventid`s with a coarse trigger side timestamp. Because event sources are easier to register en masse than navigation sources, it would allow a reporting origin to do this with a finer granularity.


### Noise on the attribution triggering event

Attribution sources registered without a navigation will receive additional noise on whether attribution was triggered for the source. This is similar to the speculative noise discussed in the [Click Through Explainer](https://github.com/WICG/conversion-measurement-api#speculative-adding-noise-to-the-attribution-of-the-source-itself). 

When an attribution source is registered, the browser will perform one of the following steps given noise `p`:
* With probability `1 - p`, the browser logs the source as normal
* With probability `p/2`, the browser ignores any future attribution for this source
* With probability `p/2`, the browser immediately triggers attribution on the source with a random `event-source-trigger-data`. This report will still be sent at the end of the reporting window.

These steps will not be performed for navigation attribution sources.

See the [privacy considerations section](#privacy-considerations) for the rationale behind adding this noise.


### Controlling which attribution source to trigger

In the Click Through Explainer, at triggering time, the browser looks up all matching sources in storage. A [credit](https://github.com/WICG/conversion-measurement-api#multiple-sources-for-the-same-trigger-multi-touch) of 100 is assigned to the most recent matching source in storage, and a credit of 0 is assigned to the rest. Reports are sent for each of these. We propose changing this for both click sources and event sources.

To provide additional utility in prioritizing the distribution of credit between different classes of sources, the browser can associate a priority with each attribution source. This priority will be defined in a new attribute on attribution source tags, `attributionsourcepriority`, which holds a 64 bit integer.

When a trigger redirect is received, the browser will find the matching source with highest `attributionsourcepriority` value and generate a report. The other sources will not generate reports.

If reports were sent for these sources, it would be possible for `reportingorigin` to use these other reports to remove the noise on the attribution triggering event, unless we introduced a mechanism to noise the sources dependently on others. 


### Single Reporting Window

Attribution sources registered without a navigation will be reported at the end of their expirations, compared to the three reporting windows for navigation sources.

This limits the amount of information that can be learned about the time a report was created in comparison to the [Click Through API](https://github.com/WICG/conversion-measurement-api#reporting-delay).

## Privacy Considerations
The privacy goals of this proposal are in line with those in the [Click Through Explainer](https://github.com/WICG/conversion-measurement-api#privacy-considerations).

 >The main privacy goal of the API is to make linking identity between two different top-level sites difficult. This happens when either a request or a JavaScript environment has two user IDs from two different sites simultaneously.

Further, the addition of event noising protects against any cross site data leakage based on `p`.


### Less trigger side data

Registering event attribution sources is not gated on a user interaction or top level navigation, allowing them to be registered more frequently and with greater ease. For example, by restricting to 1 bit of data and 1 report per source, a `reportingorigin` would need to register many more sources in order to link cross-site identity relative to the Click Through API.

This is further restricted by rate limiting the usage of the API between two sites, using [reporting cooldowns](https://github.com/WICG/conversion-measurement-api#reporting-cooldown). Due to the different characteristics between classes of sources, these cooldowns should have independent limits on the number of reports of each type.

The number of reporting windows is another vector which can contain trigger side information. By restricting to a [single window](#single-reporting-window), a `reportingorigin` does not receive any additional information on when in the attribution window a source was triggered.


## Browsing history reconstruction

Reporting attribution without a pre-existing navigation allows the `reportingorigin` to learn whether a given user on the source site visited the `attributiondestination` site at all. For click-through reports, this is not an issue because the `reportingorigin` knows a priori the user was navigating to `attributiondestination`.

This new threat is/can be mitigated in a number of ways:

### Plausible Deniability

By adding noise to whether an attribute source gets [triggered](#noise-on-the-attribution-triggering-event), a `reportingorigin` will not know with absolute certainty whether a user actually visited a site. In fact, this additional mitigation gives some local differential privacy guarantees on the data in the API.

It becomes important for browsers to ensure that other API parameters do not allow a `reportingorigin` to easily denoise reports for a given `attributionsourceeventid`. For example, if multiple reports were sent for each source it may allow reporters to use the number of reports as a mechanism to remove noise, and may require browsers to implement more complex noise logic.

Note: Since conversion rates in practice are extremely rare events, we need to be careful to set the noise parameter so as not to ruin the utility of this API (i.e. noise drowns out signal).

### Limiting the number of unique sites covered by pending sources

To limit the breadth of `attributiondestination` sites that a `reportingorigin` may be trying to measure user visits on, the browser can limit the number `attributiondestination` eTLD+1s represented by pending sources for a source-site.

The browser can place a limit on the number of a source site's pending source's unique `attributiondestination`s. When an attribution source is registered for an eTLD+1 that is not already in the pending sources and a source site is at its limit, the browser will delete the oldest pending attribution source from the source site. If after deleting the oldest source, the source site is still at its limit, the browser will continue to delete pending sources until it is able to make room for the newly registered source.

The lower this value, the harder it is for a `reportingorigin` to use the API to try and measure user browsing activity not associated with ads being shown. Browsers may choose parameters on the number of `attributiondestination`s to make their own tradeoffs for privacy and utility.

Because this limit is per source site, it is possible for different `reportingorigin`s on a site to push the other attribution sources out of the browser. To limit abuse by potentially bad actors, the browser could consider adding a source-site side configuration which could partition this queue into smaller queues managed per `reportingorigin`.
