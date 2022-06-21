The [draft Attribution Reporting API
specification](https://wicg.github.io/attribution-reporting-api) defines a
number [vendor-specific
values](https://wicg.github.io/attribution-reporting-api/#vendor-specific-values).

Chromium's implementation assigns the following values:

# [Source event ID cardinality](https://wicg.github.io/attribution-reporting-api/#source-event-id-cardinality)
[2<sup>64</sup>](https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_storage_delegate_impl.cc;l=312;drc=169c6cc102b39295a5bfe2f2a176b42b1c2fe2c4)

# [Max source expiry](https://wicg.github.io/attribution-reporting-api/#max-source-expiry)
[30 days](https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/common_source_info.cc;l=21;drc=f14ff8f54314121e0108fcd6236532c9dba27822)

# [Max entries per filter map](https://wicg.github.io/attribution-reporting-api/#max-entries-per-filter-map)
[50](https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/public/common/attribution_reporting/constants.h;l=12;drc=169c6cc102b39295a5bfe2f2a176b42b1c2fe2c4)

# [Max values per filter entry](https://wicg.github.io/attribution-reporting-api/#max-values-per-filter-entry)
[50](https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/public/common/attribution_reporting/constants.h;l=11;drc=169c6cc102b39295a5bfe2f2a176b42b1c2fe2c4)

# [Max pending sources per source origin](https://wicg.github.io/attribution-reporting-api/#max-pending-sources-per-source-origin)
[1024](https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_storage_delegate_impl.cc;l=94;drc=0eeaeb3261fd1ba378c57779245d5875121ab431)

# [Navigation-source trigger data cardinality](https://wicg.github.io/attribution-reporting-api/#navigation-source-trigger-data-cardinality)
[8](https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_storage_delegate_impl.cc;l=31;drc=0eeaeb3261fd1ba378c57779245d5875121ab431)

# [Event-source trigger data cardinality](https://wicg.github.io/attribution-reporting-api/#event-source-trigger-data-cardinality)
[2](https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_storage_delegate_impl.cc;l=33;drc=0eeaeb3261fd1ba378c57779245d5875121ab431)

# [Randomized navigation-source trigger rate](https://wicg.github.io/attribution-reporting-api/#randomized-navigation-source-trigger-rate)
[0.0024](https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_reporting.cc;l=12;drc=169c6cc102b39295a5bfe2f2a176b42b1c2fe2c4)

# [Randomized event-source trigger rate](https://wicg.github.io/attribution-reporting-api/#randomized-event-source-trigger-rate)
[.0000025](https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_reporting.cc;l=13;drc=169c6cc102b39295a5bfe2f2a176b42b1c2fe2c4)

# [Max reports per attribution destination](https://wicg.github.io/attribution-reporting-api/#max-reports-per-attribution-destination)
[1024](https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_storage_delegate_impl.cc;l=100;drc=0eeaeb3261fd1ba378c57779245d5875121ab431)

# [Max attributions per navigation source](https://wicg.github.io/attribution-reporting-api/#max-attributions-per-navigation-source)
[3](https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_storage_delegate_impl.cc;l=86;drc=0eeaeb3261fd1ba378c57779245d5875121ab431)

# [Max attributions per event source](https://wicg.github.io/attribution-reporting-api/#max-attributions-per-event-source)
[1](https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_storage_delegate_impl.cc;l=88;drc=0eeaeb3261fd1ba378c57779245d5875121ab431)

# [Attribution rate-limit window](https://wicg.github.io/attribution-reporting-api/#attribution-rate-limit-window)
[30 days](https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_storage_delegate_impl.cc;l=113;drc=0eeaeb3261fd1ba378c57779245d5875121ab431)

# [Max source reporting endpoints per rate-limit window](https://wicg.github.io/attribution-reporting-api/#max-source-reporting-endpoints-per-rate-limit-window)
[100](https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_storage_delegate_impl.cc;l=114;drc=0eeaeb3261fd1ba378c57779245d5875121ab431)

# [Max attribution reporting endpoints per rate-limit window](https://wicg.github.io/attribution-reporting-api/#max-source-reporting-endpoints-per-rate-limit-window)
[10](https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_storage_delegate_impl.cc;l=115;drc=0eeaeb3261fd1ba378c57779245d5875121ab431)

# [Max attributions per rate-limit window](https://wicg.github.io/attribution-reporting-api/#max-attributions-per-rate-limit-window)
[100](https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_storage_delegate_impl.cc;l=116;drc=0eeaeb3261fd1ba378c57779245d5875121ab431)

# [Max source cache size](https://wicg.github.io/attribution-reporting-api/#max-source-cache-size)
\infty

# [Max report cache size](https://wicg.github.io/attribution-reporting-api/#max-report-cache-size)
\infty
