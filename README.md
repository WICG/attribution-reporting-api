
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
- [Overview](#overview)
  - [Impression Declaration](#impression-declaration)
    - [Permission Delegation](#permission-delegation)
  - [Conversion Registration](#conversion-registration)
    - [Metadata limits and noise](#metadata-limits-and-noise)
    - [Register a conversion algorithm](#register-a-conversion-algorithm)
    - [Multiple impressions for the same conversion (Multi-touch)](#multiple-impressions-for-the-same-conversion-multi-touch)
    - [Multiple conversions for the same impression](#multiple-conversions-for-the-same-impression)
  - [Sending Scheduled Reports](#sending-scheduled-reports)
    - [Conversion Reports](#conversion-reports)
  - [Metadata Encoding](#metadata-encoding)
- [Sample Usage](#sample-usage)
- [Privacy Considerations](#privacy-considerations)
  - [Conversion Metadata](#conversion-metadata)
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
identifiers like third party cookies are either unavailable or
undesirable. A new API surface can be added to the web platform to
satisfy this use-case without them, in a way that provides better
privacy to users.

This API alone will not be able to support all conversion measurement
use cases, such as view conversions, or even click conversion reporting
with richer / more accurate conversion metadata. We envision this API as
one of potentially many new API’s that will seek to reproduce valid
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

An impression is an anchor tag with special attributes:

`<a addestination=”[eTLD+1]” impressiondata=”[string]”
impressionexpiry=[unsigned long long] reportingdomain=”[eTLD+1]”>`

Impression attributes:

-   `addestination`: is the intended eTLD+1 destination of the ad click

-   `impressiondata`: is the event-level data associated with this impression. This will be limited to 64 bits of information, [encoded as a hexadecimal string](#metadata-encoding). This value can vary by UA.

-   `impressionexpiry`: (optional) expiry in milliseconds for when the impression should be deleted. Default will be 7 days, with a max value of 30 days.

-   `reportingdomain`: (optional) is the desired eTLD+1 endpoint that the conversion report for this impression should go to. Default will be the top level domain (eTLD+1) of the page.

Clicking on an anchor tag that specifies these attributes will log a
click impression event to storage if the resulting document being
navigated to ends up sharing the ad destination eTLD+1. A clicked
impression logs <impressiondata, addestination, reportingdomain,
impressionexpiry> to a new browser storage area.

When an impression is logged for <reportingdomain,
addestination>, existing impressions matching this pair will be
looked up in storage. If the matching impressions have converted at
least once (i.e. have scheduled a report), they will be removed from
browser storage and will not be eligible for further reporting. Any
pending conversion reports for these impressions will still be sent.

### Permission Delegation

In order to prevent arbitrary third parties from receiving conversion
reports without the publisher’s knowledge, conversion measurement
reporting in nested iframes will need to be enabled via some sort of
permission delegation. One way this could work is a new [Feature Policy](https://w3c.github.io/webappsec-feature-policy/) that is
[parameterized](https://github.com/w3c/webappsec-feature-policy/issues/163) by a string:

```
<iframe src=”https://advertiser.test” allow=”conversion-reporting ‘src’ (https://ad-tech.com)”>

<a … id=”impressionTag” reportingdomain=”https://ad-tech.com”></a>

</iframe>
```

In child contexts, reporting domains are restricted to only those that were
explicitly allowed via Feature Policy delegation. Any other values will be ignored.
This is done to ensure that a publisher page must opt-in to any domain that
wants to receive impression reports. Impressions in the main frame are trusted
and can set any reporting domain (i.e. it has a default allow-list of *), but a
Feature Policy response header set on the main document response could
optionally restrict it further.

An impression will be eligible for reporting if any page on the
addestination domain (advertiser site) registers a conversion to the
associated reporting domain.

Note: there may be some issues with using Feature Policy this way that
we’ll need to find solutions for. See [this issue](https://github.com/csharrison/conversion-measurement-api/issues/1)
for more detail.

Conversion Registration
-----------------------

This API will use a similar mechanism for conversion registration as the
[Ad Click Attribution Proposal](https://wicg.github.io/ad-click-attribution/index.html#legacytriggering).

Conversions are meant to occur on ad destination pages. A conversion
will be registered for a given reporting domain through an HTTP GET to
the reporting domain that redirects to a [.well-known](https://tools.ietf.org/html/rfc5785)
location. It is required to be the result of a redirect so that the
reporting domain can make server-side decisions about when attribution
reports should trigger. Conversions can only be registered in the main
document.

Today, conversion pixels are frequently used to register conversions on
advertiser pages. These can be repurposed to register conversions in
this API:

```
<img src="https://ad-tech.test/conversiontracker"/>
```
`https://ad-tech.test/conversiontracker` can be redirected to `https://ad-tech.test/.well-known/register-conversion`
to trigger a conversion event.

The browser will treat redirects to a url of the form:
`https://<reportingdomain>/.well-known/register-conversion[?conversion-metadata=<metadata>]`

as a special request, where optional metadata associated with the
conversion is specified via a query parameter.

When the special redirect is detected, the user agent will schedule a
conversion report as detailed in [Register a conversion algorithm](#register-a-conversion-algorithm).

### Metadata limits and noise

Impression metadata will be limited to 64 bits of information to enable
uniquely identifying an ad click.

Conversion metadata must therefore be limited quite strictly, both in
the amount of data, and in noise we apply to the data. Our strawman
initial proposal is to allow 3 bits of conversion data, with 5%
noise applied (that is, with 5% chance, we send a random 3 bits). See
[privacy considerations](#conversion-metadata) for more information. These
values should be allowed to vary by UA.

Disclaimer: Adding or removing a single bit of metadata has large
trade-offs in terms of user privacy and usability to advertisers.
Browsers should concretely evaluate the trade-offs from these two
perspectives before setting a limit. As such, this number is subject to
change based on community feedback. Our encoding scheme should also
support fractions of bits, as it’s possible to limit metadata to values
from 0-5 (~2.6 bits of information)

### Register a conversion algorithm

When the user agent receives a conversion registration on a URL matching
the addestination eTLD+1, it looks up all impressions in storage that
match <reporting-domain, addestination>.

The most recent matching impression is given a `last-clicked` attribute of
true. All other matching impressions are given a `last-clicked` value of
false.

For each matching impression, schedule a report. To schedule a report,
the browser will store the 
 {reporting domain, addestination domain, impression data, [decoded](#metadata-encoding) conversion-metadata, last-clicked attribute} for the impression.
Scheduled reports will be sent as detailed in [Sending scheduled reports](#sending-scheduled-reports).

Each impression is only allowed to schedule a maximum of three reports
(see [Multiple conversions for the same impression](#multiple-conversions-for-the-same-impression)). Once
reports are scheduled for a given conversion registration, the browser
will delete all impressions that have scheduled three reports.

### Multiple impressions for the same conversion (Multi-touch)

If there are multiple impressions that were clicked and lead to a single
conversion, send conversion reports for all of them, but label the
last-clicked one as such. There are many possible alternatives to this,
like providing a choice of rules-based attribution models. However, it
isn’t clear the benefits outweigh the additional complexity.

Additionally, models other than last-click potentially leak more
cross-site information if impressions are clicked across different
sites.

### Multiple conversions for the same impression

Many ad clicks end up converting multiple times, for instance if a user
goes through a checkout and a purchase flow. To support this in a
privacy preserving way, we need to make sure that subsequent conversions
do not leak too much data.

One possible solution, outlined in this document, is for UAs to specify
a maximum number of conversion registrations per click. In this document
our initial proposal is 3.

Note that subsequent conversions for the same impression do not refresh
the reporting windows (see [Sending Scheduled Reports](#sending-scheduled-reports)).

Note that from a usability perspective, it is important that all
conversion reports for the same impression are allowed the same amount
of metadata. Otherwise, it becomes quite difficult for advertisers to
efficiently use the space of possible metadata values.

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

Otherwise: Conversions will be reported `impressionexpiry`
milliseconds from impression time

When a conversion report is scheduled, it will be delayed until the next
applicable reporting window for the associated impression. Once the
window has finished, the report will be sent out of band.

If there are multiple reports for an impression scheduled within the
same window, the reports will be sent at the same time but in a random
order.

The report may be sent at a later date if the browser was not running
when the window finished. In this case, reports will be sent on startup.
The user agent may also decide to delay some of these reports for a
short random time on startup, so that they cannot be joined together
easily by a given reporting domain.

Note that to improve utility, it might be possible to randomly send
reports throughout each reporting window.

### Conversion Reports

To send a report, the user agent will make a non-credentialed secure
HTTP POST request to:

```
https://reportingdomain/.well-known/register-conversion?impression-data=&conversion-data=&last-clicked=
```

The conversion report data is included as query params as they represent
non-hierarchical data ([URI RFC](https://tools.ietf.org/html/rfc3986#section-3.4)):

-   `impression-data`: 64 bit metadata set on the impression

-   `conversion-metadata`: 3 bit metadata set in the conversion redirect

-   `last-clicked`: true or false, denotes whether this impression was the last clicked impression that led to this conversion

The advertiser site’s eTLD+1 will be added as the Referrer. Note that it
might be useful to advertise which metadata limits were used in the
report, but it isn’t included here.

It also may be beneficial to send reports as JSON instead of in the
report URL. JSON reports could allow this API to leverage the Reporting
API in the future should it be desirable.

Metadata Encoding
-----------------

Impression metadata and conversion metadata should be encoded the same
way, and in a way that is amenable to any privacy level a browser would
want to choose (i.e. the number of distinct metadata states supported).

Our proposal is to encode the metadata via hexadecimal numbers, and
interpret them modulo the maximum metadata value. That is, the algorithm
takes as input a string and performs the equivalent of:

```
function getMetadata(str, max_value) {
  return (parseInt(str, 16) % max_value).toString(16);
}
```

The benefit of this method over using a fixed bit mask is that it allows
browsers to implement max\_values that aren’t multiples of 2.

Sample Usage
============

`publisher.com` wants to show ads on their site, so they contract out to
`ad-tech.com`. `ad-tech.com` script in the main document creates a
cross-origin iframe to host the third party advertisement for
`toasters.com`, and sets `ad-tech.com` to be an allowed reporting domain.

Within the iframe, `toasters.com` code annotates their anchor tags to use
the `ad-tech.com` reporting domain, and uses impression data that allows
`ad-tech.com` to identify the ad click (0x12345678)
```
<iframe src=”https://ad-tech-3p.test/show-some-ad” allow=”conversion-reporting ‘src’ (https://ad-tech.com)”>
...
<a 
  href=”https://toasters.com/purchase”
  addestination=”https://toasters.com”
  impressiondata=”0x12345678”
  reportingdomain=”https://ad-tech.com”
  impressionexpiry=604800000>
...
</iframe>
```

A user clicks on the ad and has a window open that lands on a URL to
`toasters.com/purchase`. An impression event is logged to browser storage
since the landing page matches the ad destination. The following data is
stored:

```
{
  impression-data: 0x12345678,
  ad-destination: https://toasters.com,
  reporting-domain: https://ad-tech.com,
  impression-expiry: <now() + 604800>
}
```

2 days later, the user buys something on `toasters.com`. `toasters.com`
registers conversions on the few different ad-tech companies it buys
impressions on, including `ad-tech.com`, by adding conversion pixels:

```
<img src=”https://ad-tech.com/conversion?model=toastmaster3000&price=$49.99&...” />
```

`ad-tech.com` receives this request, and decides to trigger a conversion
on `toasters.com`. They must compress all of the conversion metadata into
3 bits, so `ad-tech.com` chooses to encode the value as “2” (e.g. some
bucketed version of the purchase value). They respond with a 302
redirect to:
```
https://ad-tech.com/.well-known/register-conversion?conversion-metadata=0x2
```

The browser sees this request, and schedules a conversion report to be
sent. The conversion report is associated with the 7 day deadline as the
2 day deadline has passed. Roughly 5 days later, `ad-tech.com` receives
the following HTTP POST:
```
https://ad-tech.com/.well-known/register-conversion?impression-data=12345678&conversion-metadata=2&last-click=true
```

Privacy Considerations
======================

The privacy goal of the API is to make it difficult to communicate
information about a specific user between the publisher and advertiser
sites. Limits should be put into place to make attempts to do so both
hard and detectable, and different UAs should be able to set these
limits to different values.

Note that this privacy goal differs from that of Safari's "Privacy
Preserving Ad Click Attribution". Safari wishes to keep the publisher
from learning even the fact that a specific ad click led to a
conversion. This proposal (by allowing 64 bits of impression metadata)
allows the publisher to learn that the conversion happened, but not to
easily learn information the advertiser knows about the user who
converted, or to join the two sides' notions of the user's identity.

Conversion Metadata
-------------------

Conversion metadata is extremely important for critical use-cases like
reporting the *value* of a conversion. However, too much conversion
metadata could be used to link advertiser identity with publisher
identity.

Mitigations against this are to provide only coarse information (only a
few bits at a time), and introduce some noise to the conversion. Even
sophisticated attackers will therefore need to invoke the API many times
(through many clicks) to join identity between sites with high
confidence.

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
domains (via injecting many `<img>` tags on the page), then the
publisher and advertiser don’t necessarily have to agree apriori on what
reporting domains to use, and which domain actually ends up getting used
reveals some extra information.

To prevent abuse, it makes sense for UAs to add limits here, potentially
on a per-page load or per-reporting epoch basis.

Clearing Site Data
------------------

Impressions / conversions in browser storage should be clearable using
existing “clear browsing data” functionality offered by UAs.

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

Another way to add privacy to this system is to not only add noise to
the conversion metadata, but to whether the conversion occurred in the
first place. That is:

-   With some probability *p*, true conversions will be dropped

-   With some probability *q*, impressions that have not converted will be marked as converted, and given random conversion metadata.

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
extra information. Allowing different conversion metadata for different
reporting endpoints makes things even more difficult.

This problem becomes a bit easier if reporting partners mutually trust
each other, and can share reporting server-to-server.
