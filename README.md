
Click Through Conversion Measurement Event-Level API Explainer
============

This document is an explainer for a potential new web platform feature
which allows for measuring and reporting ad click conversions.

(Name probably needs bikeshedding)

See the explainer on [aggregate measurement](AGGREGATE.md) for a potential extension on top of this.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

  - [Glossary](#glossary)
  - [Motivation](#motivation)
  - [Prior Art](#prior-art)
- [Click Through Conversion Measurement Event-Level API Explainer](#click-through-conversion-measurement-event-level-api-explainer)
  - [Glossary](#glossary)
  - [Motivation](#motivation)
  - [Prior Art](#prior-art)
- [Overview](#overview)
  - [Impression Declaration](#impression-declaration)
    - [Registering impressions for anchor tag navigations](#registering-impressions-for-anchor-tag-navigations)
    - [Registering impressions for window.open() navigations](#registering-impressions-for-windowopen-navigations)
    - [Handling an impression event](#handling-an-impression-event)
    - [Publisher-side Controls for Impression Declaration](#publisher-side-controls-for-impression-declaration)
  - [Conversion Registration](#conversion-registration)
    - [Data limits and noise](#data-limits-and-noise)
    - [Register a conversion algorithm](#register-a-conversion-algorithm)
    - [Multiple impressions for the same conversion (Multi-touch)](#multiple-impressions-for-the-same-conversion-multi-touch)
    - [Multiple conversions for the same impression](#multiple-conversions-for-the-same-impression)
  - [Sending Scheduled Reports](#sending-scheduled-reports)
    - [Conversion Reports](#conversion-reports)
  - [Data Encoding](#data-encoding)
- [Sample Usage](#sample-usage)
- [Privacy Considerations](#privacy-considerations)
  - [Conversion Data](#conversion-data)
  - [Conversion Delay](#conversion-delay)
  - [Limits on the number of conversion pixels](#limits-on-the-number-of-conversion-pixels)
  - [Clearing Site Data](#clearing-site-data)
  - [Reporting cooldown](#reporting-cooldown)
  - [Speculative: Limits based on first party storage](#speculative-limits-based-on-first-party-storage)
  - [Speculative: Adding noise to the conversion event itself](#speculative-adding-noise-to-the-conversion-event-itself)
- [Open Questions](#open-questions)
  - [Multiple Reporting Endpoints Per Conversion](#multiple-reporting-endpoints-per-conversion)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

Glossary
--------

-   **Publisher**: Page that shows ads, sells ad slots

-   **Advertiser**: Purchaser of ad slots, conversions happen on advertiser sites

-   **Impression**: View of an ad

-   **Conversion**: The completion of a meaningful (advertiser specified) user action on the advertiser's web site by a user who has previously interacted with an ad from that advertiser.

-   **Event-level data**: Data that can be tied back to a specific low-level event; not aggregated

-   **Click-through-conversion (CTC)**: A conversion credit attributed to an impression that was clicked

Motivation
----------

Currently, the web ad industry measures conversions via identifiers they
can associate across sites. These identifiers tie information about
which ads were clicked to information about activity on the advertiser's
site (the conversion). This allows advertisers to measure ROI, and for
the entire ads ecosystem to understand how well ads perform.

Since the ads industry today uses common identifiers across advertiser
and publisher sites to track conversions, these common identifiers can
be used to enable other forms of cross-site tracking.

This doesn’t have to be the case, though, especially in cases where
identifiers such as third-party cookies are either unavailable or
undesirable. A new API surface can be added to the web platform to
satisfy this use case without them, in a way that provides better
privacy to users.

This API alone will not be able to support all conversion measurement
use cases, such as view conversions, or even click conversion reporting
with richer / more accurate conversion data. We envision this API as
one of potentially many new APIs that will seek to reproduce valid
advertising use cases in the web platform in a privacy preserving way.
In particular, we think this API could be extended by using server side
aggregation to provide richer data, which we are continuing to explore.

Prior Art
---------

There is an alternative [Ad Click Attribution](https://github.com/WICG/ad-click-attribution) draft spec in the WICG. See this [WebKit blog post](https://webkit.org/blog/8943/privacy-preserving-ad-click-attribution-for-the-web/) for more details.

Brave has published and implemented an [Ads Confirmation Protocol](https://github.com/brave/brave-browser/wiki/Security-and-privacy-model-for-ad-confirmations).

Overview
========

Impression Declaration
----------------------

### Registering impressions for anchor tag navigations

An impression tag is an anchor tag with special attributes:

`<a conversiondestination="[eTLD+1]" impressiondata="[string]"
impressionexpiry=[unsigned long long] reportingorigin="[origin]">`

Impression attributes:

-   `conversiondestination`: the intended eTLD+1 destination of the ad click.

-   `impressiondata`: the event-level data associated with this impression. This will be limited to 64 bits of information, [encoded as a hexadecimal string](#data-encoding), but the value can vary for browsers that want a higher level of privacy.

-   `impressionexpiry`: (optional) expiry in milliseconds for when the impression should be deleted. Default is 30 days, with a maximum value of 30 days. The maximum expiry can also vary between browsers.

-   `reportingorigin`: (optional) the desired endpoint that the conversion report for this impression should go to. Default is the top level origin of the page.

Clicking on an anchor tag that specifies these attributes will create a new impression event that will be handled according to [Handling an impression event](#handling-an-impression-event)

### Registering impressions for window.open() navigations

An impression event can be registered for navigations initiated by [`window.open()`](https://html.spec.whatwg.org/multipage/window-object.html#dom-open).

An impression is registered through a new `window.open()` overload:

```
WindowProxy? open(
  optional USVString url = "",
  optional DOMString target = "_blank",
  optional [LegacyNullToEmptyString] DOMString features = "",
  optional ImpressionParams impression_params)
```

`ImpressionParams` is a dictionary which contains the same impression attributes used by impression anchor tags:

```
dictionary ImpressionParams {
  required DOMString impressionData;
  required USVString conversionDestination;
  optional USVString reportingOrigin;
  optional unsigned long impressionExpiry;
}
```

At the time window.open() is invoked, if the associated window has a [transient activation](https://html.spec.whatwg.org/multipage/interaction.html#transient-activation), an impression event will be created and handled following [Handling an impression event](#handling-an-impression-event).

### Handling an impression event

An impression event will be logged to storage if the resulting document being
navigated to ends up sharing the conversion destination eTLD+1. Concretely, this
impression logs <`impressiondata`, `conversiondestination`, `reportingorigin`,
`impressionexpiry`> to a new browser storage area.

When an impression is logged for <`reportingorigin`,
`conversiondestination`>, existing impressions matching this pair will be
looked up in storage. If the matching impressions have converted at
least once (i.e. have scheduled a report), they will be removed from
browser storage and will not be eligible for further reporting. Any
pending conversion reports for these impressions will still be sent.

An impression will be eligible for reporting if any page on the	
`conversiondestination` domain (advertiser site) registers a conversion to the	
associated reporting origin.


### Publisher-side Controls for Impression Declaration

In order to prevent arbitrary third parties from registering impressions without the publisher’s knowledge, the Conversion Measurement
API will need to be enabled in child contexts by a new [Feature Policy](https://w3c.github.io/webappsec-feature-policy/):

```
<iframe src="https://advertiser.test" allow="conversion-measurement ‘src’)">

<a … id="impressionTag" reportingorigin="https://ad-tech.com"></a>

</iframe>
```

The API will be enabled by default in the top-level context and in same-origin children. Any script running in these contexts can declare an impression with any reporting origin. Publishers who wish to explicitly disable the API for all parties can do so via an [HTTP header](https://w3c.github.io/webappsec-feature-policy/#feature-policy-http-header-field).

Without a Feature Policy, a top-level document and cooperating iframe could recreate this functionality. This is possible by using [postMessage](https://html.spec.whatwg.org/multipage/web-messaging.html#dom-window-postmessage) to send impression data, reporting origin, and conversion destination to the top level document who can then wrap the iframe in an anchor tag (with some additional complexities behind handling clicks on the iframe). Using Feature Policy prevents the need for these hacks. This is inline with the classification of powerful features as discussed on [this issue](https://github.com/w3c/webappsec-feature-policy/issues/252).

Conversion Registration
-----------------------

This API will use a mechanism for conversion registration similar to the
[Ad Click Attribution Proposal](https://wicg.github.io/ad-click-attribution/index.html#legacytriggering).

Conversions are meant to occur on conversion destination pages. A conversion
will be registered for a given reporting origin through an HTTP GET to
the reporting origin, that redirects to a [.well-known](https://tools.ietf.org/html/rfc5785)
location.
This redirect is useful, because this mechanism enables the reporting origin to make server-side decisions about when attribution
reports should trigger.
Note that `.well-known` is only used to register a path that the browser will understand; it shouldn't point to any actual resource, since the request will be cancelled internally.

Conversion registration requires the `conversion-measurement` Feature Policy to be enabled in the context the request is made. As described in [Publisher Controls for Impression Declaration](#publisher-controls-for-impression-declaration), this Feature Policy will be enabled by default in the top-level context and in same-origin children, but disabled in cross-origin children.

Today, conversion pixels are frequently used to register conversions on
advertiser pages. These can be repurposed to register conversions in
this API:

```
<img src="https://ad-tech.test/conversiontracker"/>
```
`https://ad-tech.test/conversiontracker` can be redirected to `https://ad-tech.test/.well-known/register-conversion`
to trigger a conversion event.

The browser will treat redirects to a URL of the form:
`https://<reportingorigin>/.well-known/register-conversion[?conversion-data=<data>]`

as a special request, where optional data associated with the
conversion is specified via a query parameter.

When the special redirect is detected, the browser will schedule a
conversion report as detailed in [Register a conversion algorithm](#register-a-conversion-algorithm).

### Data limits and noise

Impression data will be limited to 64 bits of information to enable
uniquely identifying an ad click.

Conversion data must therefore be limited quite strictly, by limiting the amount of data and by applying noise to the data. Our strawman
initial proposal is to allow 3 bits of conversion data, with 5%
noise applied — that is, with 5% chance, we send a random 3 bits, and the
other 95% of the time we send the real conversion-data. See
[privacy considerations](#conversion-data) for more information,
including speculative thoughts on the hard question of going farther
and [adding noise to whether or not the conversion report is even sent](https://github.com/csharrison/conversion-measurement-api#speculative-adding-noise-to-the-conversion-event-itself).
In any case, noise values should be allowed to vary between browsers.

Disclaimer: Adding or removing a single bit of data has large
trade-offs in terms of user privacy and usability to advertisers: 
* Less bits is more private but less usable to avertisers
* More bits is less private but more usable to avertisers.
Browsers should concretely evaluate the trade-offs from these two
perspectives before setting a limit. As such, this number is subject to
change based on community feedback. Our encoding scheme should also
support fractions of bits, as it’s possible to limit data to values
from 0-5 (~2.6 bits of information)

### Register a conversion algorithm

When the browser receives a conversion registration on a URL matching
the `conversiondestination` eTLD+1, it looks up all impressions in storage that
match <`reportingorigin`, `conversiondestination`>.

The most recent matching impression is given an `attribution-credit` of value 100. All other matching impressions are given an `attribution-credit` of value of 0.

For each matching impression, schedule a report. To schedule a report,
the browser will store the 
 {`reportingorigin`, `conversiondestination` domain, `impressiondata`, [decoded](#data-encoding) conversion-data, attribution-credit} for the impression.
Scheduled reports will be sent as detailed in [Sending scheduled reports](#sending-scheduled-reports).

Each impression is only allowed to schedule a maximum of three reports
(see [Multiple conversions for the same impression](#multiple-conversions-for-the-same-impression)). Once
reports are scheduled for a given conversion registration, the browser
will delete all impressions that have scheduled three reports.

### Multiple impressions for the same conversion (Multi-touch)

If multiple impressions were clicked and led to a single
conversion, send conversion reports for all of them. 

To provide additional utility, the browser can choose to provide additional annotations to each of these reports, attributing credits for the conversion to them individually. Attribution models allow for more sophisticated, accurate conversion measurement.

The default attribution model will be last-click attribution, giving the last-clicked impression for a given conversion event all of the credit.

To remain flexible, the browser sends an `attribution-credit` of value 0 to 100 for all conversion reports associated with a single conversion event. This represents the percent of attribution an impression received for a conversion. The sum of credits across a set of reports for one conversion event should equal 100.

There are many possible alternatives to this,
like providing a choice of rules-based attribution models. However, it
isn’t clear the benefits outweigh the additional complexity. Additionally, models other than last-click potentially leak more
cross-site information if impressions are clicked across different
sites.

### Multiple conversions for the same impression

Many ad clicks end up converting multiple times, for instance if a user
goes through a checkout and a purchase flow. To support this in a
privacy preserving way, we need to make sure that subsequent conversions
do not leak too much data.

One possible solution, outlined in this document, is for browsers to specify
a maximum number of conversion registrations per click. In this document
our initial proposal is 3.

Note that subsequent conversions for the same impression do not refresh
the reporting windows (see [Sending Scheduled Reports](#sending-scheduled-reports)).

Note that from a usability perspective, it is important that all
conversion reports for the same impression are allowed the same amount
of data. Otherwise, it becomes quite difficult for advertisers to
efficiently use the space of possible data values.

Sending Scheduled Reports
-------------------------

After the initial impression click between a publisher and advertiser, a
schedule of reporting windows and deadlines associated with that
impression begins. The time between the click and impression expiry can
be split into multiple reporting windows, at the end of which the
browser will send scheduled reports for that impression.

Each reporting window has a deadline, and only conversions registered
before that deadline can be sent in that window. An example of deadlines
and windows a browser could choose are:

2 days minus 1 hour: Conversions will be reported 2 days from impression
time

7 days minus 1 hour: Conversions will be reported 7 days from impression
time

`impressionexpiry`: Conversions will be reported `impressionexpiry`
milliseconds plus one hour from impression time

If `impressionexpiry` occurs before the 7 day window deadline it will be used as the next reporting window. For example, if `impressionexpiry` is 3 days, there will be two deadlines, 2 days minus one hour and `impressionexpiry`. If `impressionexpiry` is before the 2 day deadline, the 2 day deadline will still be used. 

When a conversion report is scheduled, it will be delayed until the next
applicable reporting window for the associated impression. Once the
window has finished, the report will be sent out of band.

If there are multiple reports for an impression scheduled within the
same window, the reports will be sent at the same time but in a random
order.

The report may be sent at a later date if the browser was not running
when the window finished. In this case, reports will be sent on startup.
The browser may also decide to delay some of these reports for a
short random time on startup, so that they cannot be joined together
easily by a given reporting origin.

Note that to improve utility, it might be possible to randomly send
reports throughout each reporting window.

### Conversion Reports

To send a report, the browser will make a non-credentialed (i.e. without session cookies) secure
HTTP POST request to:

```
https://reportingorigin/.well-known/register-conversion?impression-data=&conversion-data=&attribution-credit=
```

The conversion report data is included as query params as they represent
non-hierarchical data ([URI RFC](https://tools.ietf.org/html/rfc3986#section-3.4)):

-   `impression-data`: 64 bit data set on the impression

-   `conversion-data`: 3 bit data set in the conversion redirect

-   `attribution-credit`: integer in range [0, 100], denotes the percentage of credit this impression received for the given conversion. If a conversion only had one matching impression, this will be 100.

The advertiser site’s eTLD+1 will be added as the Referrer. Note that it
might be useful to advertise which data limits were used in the
report, but it isn’t included here.

It also may be beneficial to send reports as JSON instead of in the
report URL. JSON reports could allow this API to leverage the Reporting
API in the future should it be desirable.

Data Encoding
-----------------

Impression data and conversion data should be encoded the same
way, and in a way that is amenable to any privacy level a browser would
want to choose (i.e. the number of distinct data states supported).

Our proposal is to encode the data via hexadecimal numbers, and
interpret them modulo the maximum data value. That is, the algorithm
takes as input a string and performs the equivalent of:

```
function getData(str, max_value) {
  return (parseInt(str, 16) % max_value).toString(16);
}
```

The benefit of this method over using a fixed bit mask is that it allows
browsers to implement max\_values that aren’t multiples of 2. That is,
browers can choose a "fractional" bit limit if they want to.

Sample Usage
============

`publisher.com` wants to show ads on their site, so they contract out to
`ad-tech.com`. `ad-tech.com`'s script in the main document creates a
cross-origin iframe to host the third party advertisement for
`toasters.com`, and sets `ad-tech.com` to be an allowed reporting origin.

Within the iframe, `toasters.com` code annotates their anchor tags to use
the `ad-tech.com` reporting origin, and uses impression data that allows
`ad-tech.com` to identify the ad click (12345678)
```
<iframe src="https://ad-tech-3p.test/show-some-ad" allow="conversion-reporting ‘src’ (https://ad-tech.com)">
...
<a 
  href="https://toasters.com/purchase"
  conversiondestination="https://toasters.com"
  impressiondata="12345678"
  reportingorigin="https://ad-tech.com"
  impressionexpiry=604800000>
...
</iframe>
```

A user clicks on the ad and this opens a window that lands on a URL to
`toasters.com/purchase`. An impression event is logged to browser storage
since the landing page matches the conversion destination. The following data is
stored:

```
{
  impression-data: 12345678,
  conversion-destination: https://toasters.com,
  reporting-origin: https://ad-tech.com,
  impression-expiry: <now() + 604800>
}
```

2 days later, the user buys something on `toasters.com`. `toasters.com`
registers conversions on the few different ad-tech companies it buys
impressions on, including `ad-tech.com`, by adding conversion pixels:

```
<img src="https://ad-tech.com/conversion?model=toastmaster3000&price=$49.99&..." />
```

`ad-tech.com` receives this request, and decides to trigger a conversion
on `toasters.com`. They must compress all of the conversion data into
3 bits, so `ad-tech.com` chooses to encode the value as “2" (e.g. some
bucketed version of the purchase value). They respond with a 302
redirect to:
```
https://ad-tech.com/.well-known/register-conversion?conversion-data=2
```

The browser sees this request, and schedules a conversion report to be
sent. The conversion report is associated with the 7 day deadline as the
2 day deadline has passed. Roughly 5 days later, `ad-tech.com` receives
the following HTTP POST:
```
https://ad-tech.com/.well-known/register-conversion?impression-data=12345678&conversion-data=2&attribution-credit=100
```

Privacy Considerations
======================
The main privacy goal of the API is to make _linking identity_ between two different top-level sites difficult. This happens when either a request or a Javascript environment has two user IDs from two different sites simultaneously.

In this API, the 64-bit impression ID can encode a user ID from the publisher’s top level site, but the low entropy, noisy conversion data could only encode a small part of a user ID from the advertiser’s top-level site. The impression ID and the conversion data are never exposed to a Javascript environment together, and the request that includes both of them is sent without credentials and at a different time from either event, so the request adds little new information linkable to these events.

While this API _does_ allow you to learn "which ad clicks converted", it isn’t enough to link the user's identity on the publisher's and advertiser's side, unless there is serious abuse of the API, i.e. abusers are using error correcting codes and many clicks to slowly and probabilistically learn advertiser IDs associated with publisher ones. We explore some mitigations to this attack below.


Conversion Data
-------------------

Conversion data is extremely important for critical use cases like
reporting the *purchase value* of a conversion. However, too much conversion
data could be used to link advertiser identity with publisher
identity.

Mitigations against this are to provide only coarse information (only a
few bits at a time), and introduce some noise to the conversion. Even
sophisticated attackers will therefore need to invoke the API many times
(through many clicks) to join identity between sites with high
confidence.

Note that this noise still allows for aggregate measurement of bucket sizes
with an unbiased estimator. See generic approaches of dealing with
[Randomized response](https://en.wikipedia.org/wiki/Randomized_response) for
a starting point.

Conversion Delay 
-----------------

By bucketing reports within a small number reporting deadlines, it
becomes harder to associate a conversion report with the identity of the
user on the advertiser’s site via timing side channels.

Conversions within the same reporting window occur within an anonymity
set with all others during that time period. For example, if we didn’t
bucket conversion reports, the reports (which contain publisher ids)
could be easily joined up with the advertiser’s first party information
via correlating timestamps.

Note that the delay windows / deadlines chosen represent a trade-off
with utility, since it becomes harder to properly assign credit to a
click if the time from click to conversion is not known. That is,
time-to-conversion is an important signal for proper conversion
attribution. Browsers should make sure that this trade-off is concretely
evaluated for both privacy and utility before deciding on a delay.

Limits on the number of conversion pixels
-----------------------------------------

If the advertiser is allowed to cycle through many possible reporting
origins (via injecting many `<img>` tags on the page), then the
publisher and advertiser don’t necessarily have to agree apriori on what
reporting origin to use, and which origin actually ends up getting used
reveals some extra information.

To prevent abuse, it makes sense for browsers to add limits here, potentially
on a per-page load or per-reporting epoch basis.

Clearing Site Data
------------------

Impressions / conversions in browser storage should be clearable using
existing “clear browsing data" functionality offered by browsers.

Reporting cooldown
------------------

To limit the amount of user identity leakage between a <publisher,
advertiser> pair, the browser should throttle the amount of total
information sent through this API in a given time period for a user. The
browser should set a maximum number of conversion reports per
<publisher, advertiser, user> tuple per time period. If this
threshold is hit, the browser will disable the conversion API for the
rest of the time period for that user.

The longer the cooldown windows are, the harder it is to abuse the API
and join identity. Ideally report thresholds should be low enough to
avoid leaking too much sensitive information, with cooldown windows as
long as practically possible.

It’s an open question what specific limits are possible here.

Speculative: Limits based on first party storage
------------------------------------------------

Another mitigation on joining identity across publisher and advertiser
sites is to limit the number of conversion reports for any given
<publisher, advertiser> pair until the advertiser clears their
site data. This could occur via the [Clear-Site-Data](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Clear-Site-Data)
header or by explicit user action.

To prevent linking across deletions, we might need to introduce new
options to the Clear-Site-Data header to only clear data after the page
has unloaded.

Speculative: Adding noise to the conversion event itself
--------------------------------------------------------

Another way to add privacy to this system is to add noise not only to
the [reported conversion data value](#data-limits-and-noise),
but also to whether the conversion occurred in the first place. That is:

-   With some probability *p*, true conversions will be dropped

-   With some probability *q*, impressions that have not converted will be marked as converted, and given random conversion data.

The biggest problem with this scheme is that conversion events are, in
general, *rare*. Additionally, different advertisers can have wildly
different *conversion rates*. These two facts make it very hard to pick
a *q* that works reliably without drowning out the signal with noise.
We’re still thinking of solutions here.

Additionally, sending conversion reports for impressions that never
actually converted could have real monetary impact on advertisers that
pay per conversion. Tight bounds on error estimation will be crucial for
correct billing in these cases.

Open Questions
==============

Multiple Reporting Endpoints Per Conversion
-------------------------------------------

An advertiser may want to send reports to multiple reporting partners at
the same time. This is very tricky to get right without revealing any
extra information. Allowing different conversion data for different
reporting endpoints makes things even more difficult.

This problem becomes a bit easier if reporting partners mutually trust
each other, and can share reporting server-to-server.
