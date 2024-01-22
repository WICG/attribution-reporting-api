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

## Flexible Event

Examples:

The `flexible-event` utility accepts comma-separated lists of the
number of windows and summary buckets per trigger data. This is
essentially an unzipped list of two-tuples, one per trigger data.

```sh
npm run flexible-event -- -w 1,2,3 -b 4,5,6
```

The utility also will parse (in a rudimentary way) the source registration
JSON to compute the number of windows / summary buckets.

```sh
npm run flexible-event -- -f /path/to/source_registration.json
```

Here is an example which matches the default config for navigation sources:

```sh
npm run flexible-event -- -w 3,3,3,3,3,3,3,3 -b 3,3,3,3,3,3,3,3 -m 3 -t navigation
```
