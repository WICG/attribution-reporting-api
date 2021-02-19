## API Surface Changes

This file describes API surface changes made during experimentation to address some feedback and requests.

### Data encoding
_[Merged](https://github.com/WICG/conversion-measurement-api/pull/106) on Feb 9, 2021_
- No more hexadecimal encoding that added unnecessary complexity, as per [this issue](https://github.com/WICG/conversion-measurement-api/issues/60).

### JSON Report format and API/attribute names 
_[Merged](https://github.com/WICG/conversion-measurement-api/pull/103) on Feb 9, 2021_
- Reports sent as an HTTP POST body instead of as URL path or query parameters, as discussed in this [issue (Private Click Measurement proposal)](https://github.com/privacycg/private-click-measurement/issues/30).
- API name and attribute names, as discussed in this [issue](https://github.com/WICG/conversion-measurement-api/issues/57) backed by Ads specialists.
