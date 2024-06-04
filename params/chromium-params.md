The [draft Attribution Reporting API
specification](https://wicg.github.io/attribution-reporting-api) defines a
number [vendor-specific
values](https://wicg.github.io/attribution-reporting-api/#vendor-specific-values).

Chromium's implementation assigns the following values:

| Name | Value |
| ---- | ----- |
| [Max pending sources per source origin][] | [4096][max pending sources per source origin value] |
| [Max settable event-level epsilon][] | [14][max settable event-level epsilon value] |
| [Randomized null attribution report rate excluding source registration time][] | [0.05][randomized null attribution report rate excluding source registration time value] |
| [Randomized null attribution report rate including source registration time][] | [0.008][randomized null attribution report rate including source registration time value] |
| [Max event-level reports per attribution destination][] | [1024][max event-level reports per attribution destination value] |
| [Max aggregatable attribution reports per attribution destination][] | [1024][max aggregatable attribution reports per attribution destination value] |
| [Max aggregatable reports per source][] | [20][max aggregatable attribution reports per source value] attribution reports, 5 debug reports|
| [Max destinations covered by unexpired sources][] | [100][max destinations covered by unexpired sources value] |
| [Destination rate-limit window][] | [1 minute][destination rate-limit window value]
| [Max destinations per rate-limit window][] | [50][max destinations per rate-limit window per reporting site] per reporting site, [200][max destinations per rate-limit window total] total
| [Max source reporting origins per rate-limit window][] | [100][max source reporting origins per rate-limit window value] |
| [Max source reporting origins per source reporting site][] | [1][max source reporting origins per source reporting site value]
| [Origin rate-limit window][] | [1 day][origin rate-limit window value]
| [Max attribution reporting origins per rate-limit window][] | [10][max attribution reporting origins per rate-limit window value] |
| [Max attributions per rate-limit window][] | [100][max attributions per rate-limit window value] |
| [Randomized aggregatable attribution report delay][] | [10 minutes][randomized aggregatable attribution report delay value] |
| [Max event-level channel capacity for navigation sources][] | [11.5 bits][max event-level channel capacity for navigations value] |
| [Max event-level channel capacity for event sources][] | [6.5 bits][max event-level channel capacity for events value] |
| [Max unique attribution scope sets per navigation][] | [1][max unique attribution scope sets per navigation value] |

[Max pending sources per source origin]: https://wicg.github.io/attribution-reporting-api/#max-pending-sources-per-source-origin
[max pending sources per source origin value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=151;drc=3be0e68c5ed56aba7c321cbaea22558eee61fc50
[Max settable event-level epsilon]: https://wicg.github.io/attribution-reporting-api/#max-settable-event-level-epsilon
[max settable event-level epsilon value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=57;drc=3733a639d724a4353463a872605119d11a1e4d37
[Randomized null attribution report rate excluding source registration time]: https://wicg.github.io/attribution-reporting-api/#randomized-null-attribution-report-rate-excluding-source-registration-time
[randomized null attribution report rate excluding source registration time value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=109;drc=3733a639d724a4353463a872605119d11a1e4d37
[Randomized null attribution report rate including source registration time]: https://wicg.github.io/attribution-reporting-api/#randomized-null-attribution-report-rate-including-source-registration-time
[randomized null attribution report rate including source registration time value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=108;drc=3733a639d724a4353463a872605119d11a1e4d37
[Max event-level reports per attribution destination]: https://wicg.github.io/attribution-reporting-api/#max-event-level-reports-per-attribution-destination
[max event-level reports per attribution destination value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=61;drc=3733a639d724a4353463a872605119d11a1e4d37
[Max aggregatable attribution reports per attribution destination]: https://wicg.github.io/attribution-reporting-api/#max-aggregatable-attribution-reports-per-attribution-destination
[max aggregatable attribution reports per attribution destination value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=90;drc=3733a639d724a4353463a872605119d11a1e4d37
[Max aggregatable reports per source]: https://wicg.github.io/attribution-reporting-api/#max-aggregatable-reports-per-source
[max aggregatable attribution reports per source value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=111;drc=3733a639d724a4353463a872605119d11a1e4d37
[Max destinations covered by unexpired sources]: https://wicg.github.io/attribution-reporting-api/#max-destinations-covered-by-unexpired-sources
[max destinations covered by unexpired sources value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=127;drc=3733a639d724a4353463a872605119d11a1e4d37
[Destination rate-limit window]: https://wicg.github.io/attribution-reporting-api/#destination-rate-limit-window
[Destination rate-limit window value]: https://source.chromium.org/chromium/chromium/src/+/refs/heads/main:content/browser/attribution_reporting/destination_throttler.h;l=30;drc=1890f3f74c8100eb1a3e945d34d6fd576d2a9061
[Max destinations per rate-limit window]: https://wicg.github.io/attribution-reporting-api/#max-destinations-per-rate-limit-window
[Max destinations per rate-limit window per reporting site]: https://source.chromium.org/chromium/chromium/src/+/refs/heads/main:content/browser/attribution_reporting/destination_throttler.h;l=29;drc=1890f3f74c8100eb1a3e945d34d6fd576d2a9061
[Max destinations per rate-limit window total]: https://source.chromium.org/chromium/chromium/src/+/refs/heads/main:content/browser/attribution_reporting/destination_throttler.h;l=28;drc=1890f3f74c8100eb1a3e945d34d6fd576d2a9061
[Max source reporting origins per rate-limit window]: https://wicg.github.io/attribution-reporting-api/#max-source-reporting-origins-per-rate-limit-window
[max source reporting origins per rate-limit window value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=28;drc=3733a639d724a4353463a872605119d11a1e4d37
[Max source reporting origins per source reporting site]: https://wicg.github.io/attribution-reporting-api/#max-source-reporting-origins-per-source-reporting-site
[max source reporting origins per source reporting site value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=46;drc=48c727720b2bac7a0ab845f2f51b776d2042656e
[Origin rate-limit window]: https://wicg.github.io/attribution-reporting-api/#origin-rate-limit-window
[origin rate-limit window value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=49;drc=48c727720b2bac7a0ab845f2f51b776d2042656e
[Max attribution reporting origins per rate-limit window]: https://wicg.github.io/attribution-reporting-api/#max-attribution-reporting-origins-per-rate-limit-window
[max attribution reporting origins per rate-limit window value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=32;drc=3733a639d724a4353463a872605119d11a1e4d37
[Max attributions per rate-limit window]: https://wicg.github.io/attribution-reporting-api/#max-attributions-per-rate-limit-window
[max attributions per rate-limit window value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=36;drc=3733a639d724a4353463a872605119d11a1e4d37
[Randomized aggregatable attribution report delay]: https://wicg.github.io/attribution-reporting-api/#randomized-aggregatable-attribution-report-delay
[randomized aggregatable attribution report delay value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=106;drc=3733a639d724a4353463a872605119d11a1e4d37
[Max event-level channel capacity for navigation sources]: https://wicg.github.io/attribution-reporting-api/#max-event-level-channel-capacity-per-source
[max event-level channel capacity for navigations value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=77;drc=f470a177bbf7e636c598fd8c9e9dee4f936e73ad
[Max event-level channel capacity for event sources]: https://wicg.github.io/attribution-reporting-api/#max-event-level-channel-capacity-per-source
[max event-level channel capacity for events value]: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/attribution_reporting/attribution_config.h;l=114;drc=22c828d3e18706a79fde266109d0e9290a679c56
[Max unique attribution scope sets per navigation]: .
[max unique attribution scope sets per navigation value]: .
