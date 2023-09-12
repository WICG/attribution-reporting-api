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

```sh
npm run flexible-event -- -w 1,2,3 -b 4,5,6
```

```sh
npm run flexible-event -- -f /path/to/source_registration.json
```
