The [draft Attribution Reporting API
specification](https://wicg.github.io/attribution-reporting-api) defines a
number [vendor-specific
values](https://wicg.github.io/attribution-reporting-api/#vendor-specific-values).

Chromium's implementation assigns the following values:

| Name | Value |
| ---- | ----- |
| [Max source expiry][] | [30 days][max source expiry value] |
| [Max entries per filter data][] | [50][max entries per filter data value] |
| [Max values per filter data entry][] | [50][max values per filter data entry value] |
| [Max aggregation keys per attribution][] | [20][max aggregation keys per attribution value] |
| [Max pending sources per source origin][] | [1024][max pending sources per source origin value] |
| [Navigation-source trigger data cardinality][] | [8][navigation-source trigger data cardinality value] |
| [Event-source trigger data cardinality][] | [2][event-source trigger data cardinality value] |
| [Randomized response epsilon][] | [14][randomized response epislon value] |
| [Randomized null report rate excluding source registration time][] | [0.05][randomized null report rate excluding source registration time value] |
| [Randomized null report rate including source registration time][] | [0.008][randomized null report rate including source registration time value] |
| [Max event-level reports per attribution destination][] | [1024][max event-level reports per attribution destination value] |
| [Max aggregatable reports per attribution destination][] | [1024][max aggregatable reports per attribution destination value] |
| [Max attributions per navigation source][] | [3][max attributions per navigation source value] |
| [Max attributions per event source][] | [1][max attributions per event source value] |
| [Max aggregatable reports per source][] | [20][max aggregatable reports per source value] |
| [Max destinations covered by unexpired sources][] | [100][max destinations covered by unexpired sources value] |
| [Attribution rate-limit window][] | [30 days][attribution rate-limit window value] |
| [Max source reporting origins per rate-limit window][] | [100][max source reporting origins per rate-limit window value] |
| [Max attribution reporting origins per rate-limit window][] | [10][max attribution reporting origins per rate-limit window value] |
| [Max attributions per rate-limit window][] | [100][max attributions per rate-limit window value] |
| [Allowed aggregatable budget per source][] | [65536][allowed aggregatable budget per source value] |
| [Min aggregatable report delay][] | [0 minutes][min aggregatable report delay value] |
| [Randomized aggregatable report delay][] | [10 minutes][randomized aggregatable report delay] |

[Max source expiry]: https://wicg.github.io/attribution-reporting-api/#max-source-expiry
[max source expiry value]: https://source.chromium.org/chromium/chromium/src/+/refs/heads/main:content/browser/attribution_reporting/attribution_constants.h;l=18;drc=b646f894a92491033bde5d1e75aba6f44c524f0e
[Max entries per filter data]: https://wicg.github.io/attribution-reporting-api/#max-entries-per-filter-data
[max entries per filter data value]: https://source.chromium.org/chromium/chromium/src/+/refs/heads/main:components/attribution_reporting/constants.h;l=14;drc=b646f894a92491033bde5d1e75aba6f44c524f0e
[Max values per filter data entry]: https://wicg.github.io/attribution-reporting-api/#max-values-per-filter-data-entry)
[max values per filter data entry value]: https://source.chromium.org/chromium/chromium/src/+/refs/heads/main:components/attribution_reporting/constants.h;l=13;drc=b646f894a92491033bde5d1e75aba6f44c524f0e)
[Max aggregation keys per attribution]: https://wicg.github.io/attribution-reporting-api/#max-aggregation-keys-per-attribution)
[max aggregation keys per attribution value]: https://source.chromium.org/chromium/chromium/src/+/refs/heads/main:components/attribution_reporting/constants.h;l=19;drc=b646f894a92491033bde5d1e75aba6f44c524f0e)
[Max pending sources per source origin]: https://wicg.github.io/attribution-reporting-api/#max-pending-sources-per-source-origin)
[max pending soures per source origin value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=122;drc=3733a639d724a4353463a872605119d11a1e4d37)
[Navigation-source trigger data cardinality]: https://wicg.github.io/attribution-reporting-api/#navigation-source-trigger-data-cardinality)
[navigation-source trigger data cardinality value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=48;drc=3733a639d724a4353463a872605119d11a1e4d37)
[Event-source trigger data cardinality]: https://wicg.github.io/attribution-reporting-api/#event-source-trigger-data-cardinality)
[event-source trigger data cardinality value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=49;drc=3733a639d724a4353463a872605119d11a1e4d37)
[Randomized response epsilon]: https://wicg.github.io/attribution-reporting-api/#randomized-response-epsilon)
[randomized response epsilon value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=57;drc=3733a639d724a4353463a872605119d11a1e4d37)
[Randomized null report rate excluding source registration time]: https://wicg.github.io/attribution-reporting-api/#randomized-null-report-rate-excluding-source-registration-time)
[randomized null report rate excluding source registration time value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=109;drc=3733a639d724a4353463a872605119d11a1e4d37)
[Randomized null report rate including source registration time]: https://wicg.github.io/attribution-reporting-api/#randomized-null-report-rate-including-source-registration-time)
[randomized null report rate including source registration time value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=108;drc=3733a639d724a4353463a872605119d11a1e4d37)
[Max event-level reports per attribution destination]: https://wicg.github.io/attribution-reporting-api/#max-event-level-reports-per-attribution-destination)
[max event-level reports per attribution destination value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=61;drc=3733a639d724a4353463a872605119d11a1e4d37)
[Max aggregatable reports per attribution destination]: https://wicg.github.io/attribution-reporting-api/#max-aggregatable-reports-per-attribution-destination)
[max aggregatable reports per attribution destination value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=90;drc=3733a639d724a4353463a872605119d11a1e4d37)
[Max attributions per navigation source]: https://wicg.github.io/attribution-reporting-api/#max-attributions-per-navigation-source)
[max attributions per navigation source value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=64;drc=3733a639d724a4353463a872605119d11a1e4d37)
[Max attributions per event source]: https://wicg.github.io/attribution-reporting-api/#max-attributions-per-event-source)
[max attributions per event source value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=65;drc=3733a639d724a4353463a872605119d11a1e4d37)
[Max aggregatable reports per source]: https://wicg.github.io/attribution-reporting-api/#max-aggregatable-reports-per-source)
[max aggregatable reports per source]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=111;drc=3733a639d724a4353463a872605119d11a1e4d37)
[Max destinations covered by unexpired sources]: https://wicg.github.io/attribution-reporting-api/#max-destinations-covered-by-unexpired-sources)
[max destinations covered by unexpired sources value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=127;drc=3733a639d724a4353463a872605119d11a1e4d37)
[Attribution rate-limit window]: https://wicg.github.io/attribution-reporting-api/#attribution-rate-limit-window)
[attribution rate-limit window value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=24;drc=3733a639d724a4353463a872605119d11a1e4d37)
[Max source reporting origins per rate-limit window]: https://wicg.github.io/attribution-reporting-api/#max-source-reporting-origins-per-rate-limit-window)
[max source reporting origins per rate-limit window value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=28;drc=3733a639d724a4353463a872605119d11a1e4d37)
[Max attribution reporting origins per rate-limit window]: https://wicg.github.io/attribution-reporting-api/#max-attribution-reporting-origins-per-rate-limit-window)
[max attribution reporting origins per rate-limit window value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=32;drc=3733a639d724a4353463a872605119d11a1e4d37)
[Max attributions per rate-limit window]: https://wicg.github.io/attribution-reporting-api/#max-attributions-per-rate-limit-window)
[max attributions per rate-limit window value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=36;drc=3733a639d724a4353463a872605119d11a1e4d37)
[Allowed aggregatable budget per source]: https://wicg.github.io/attribution-reporting-api/#allowed-aggregatable-budget-per-source)
[allowed aggregatable budget per source value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=97;drc=3733a639d724a4353463a872605119d11a1e4d37)
[Min aggregatable report delay]: https://wicg.github.io/attribution-reporting-api/#min-aggregatable-report-delay)
[min aggregatable report delay value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=105;drc=3733a639d724a4353463a872605119d11a1e4d37)
[Randomized aggregatable report delay]: https://wicg.github.io/attribution-reporting-api/#randomized-aggregatable-report-delay)
[randomized aggregatable report delay value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=106;drc=3733a639d724a4353463a872605119d11a1e4d37)
