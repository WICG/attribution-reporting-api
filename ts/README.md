# Attribution Reporting Node package

Setup:

```sh
npm install && npm run build && npm run test
```

## Header Validator

Validates headers related to the Attribution Reporting API.

Interactive form deployed at
https://wicg.github.io/attribution-reporting-api/validate-headers.

On requests:

- `Attribution-Reporting-Eligible`

On responses:

- `Attribution-Reporting-Register-OS-Source`
- `Attribution-Reporting-Register-OS-Trigger`
- `Attribution-Reporting-Register-Source`
- `Attribution-Reporting-Register-Trigger`

Sources and triggers can also be validated from the command-line:

```sh
npm run header -- --help
```

## Flexible Event

Examples:

The `flexible-event` utility accepts comma-separated lists of the
number of windows and summary buckets per trigger data. This is
essentially an unzipped list of two-tuples, one per trigger data.

```sh
npm run flexible-event -- -w 1,2,3 -b 4,5,6
```

The utility also will parse the source registration
JSON to compute the number of windows / summary buckets.

```sh
npm run flexible-event -- -f /path/to/source_registration.json
```

Here is an example which matches the default config for navigation sources:

```sh
npm run flexible-event -- -w 3,3,3,3,3,3,3,3 -b 3,3,3,3,3,3,3,3 -m 3 -t navigation
```

## Event-Level Epsilon

[Event-level epsilon](https://wicg.github.io/attribution-reporting-api/#source-registration-json-key-event_level_epsilon)
is used to compute the channel capacity of a
source and obtain a randomized source response. If a source's event
configuration exceeds channel capacity, a lower event-level epsilon
may be provided during source registration to increase noise and
reduce channel capacity to accord with the limit.

The `flexible-event` utility advises on the highest such event-level
epsilon. For example:

```sh
npm run flexible-event -- -w 1,2,3 -b 4,5,6
```

advises that by providing event-level epsilon 11.405 (default is 14.0),
randomized trigger rate is increased from 0.0072807 to 0.0894337 to
accord with the channel capacity limit for navigation sources.
