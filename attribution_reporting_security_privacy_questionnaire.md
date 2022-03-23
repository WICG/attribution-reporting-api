# Attribution Reporting API - Security and Privacy Questionnaire

Based on the [W3C TAG Self-Review Questionnaire: Security and Privacy](https://w3ctag.github.io/security-questionnaire/).

### 2.1. What information might this feature expose to Web sites or other parties, and for what purposes is that exposure necessary?

This feature exposes cross-site information to web sites, and potentially third parties. The events which the API aims to measure, ad interactions and the events which they lead to on another site, are inherently cross-site.

Event-level reports contain a high entropy identifier from one site (the source site), and a low entropy identifier from a different site (the trigger site).

Aggregatable reports contain encrypted high entropy information from both sites, but the information is not exposed directly. These reports can be processed by a trusted aggregation service to produce summary reports. Summary reports are a list of key, value pairs (effectively a histogram) which can encode this cross-site data.

The trusted aggregation service adds noise to each of these values and also bounds the number of times that records may be queried.

### 2.2. Do features in your specification expose the minimum amount of information necessary to enable their intended uses?

This kind of data minimization is a goal of the API. However, there is a very wide and varied range of use-cases which this API aims to support. The amount of information exposed is governed by a number of privacy parameters in the API. While the explainer includes strawman values for each of these, they can be customized as necessary to support increasingly (or decreasingly) useful/complex attribution measurement.

With event-level reports, the API intends to support existing cookie-based optimization use-cases. Sophisticated ads ranking is done via complex machine learning, where individual inferences need to be annotated with labels. 

Without a unique identifier for the source site (which is chosen to be 64 bits in this specific proposal) to identify which ad interaction converted, this cannot be done.

The low entropy identifier included from the trigger site (3 bits for sources where the user navigated alongside the ad interaction, 1 bit for all other cases) is required to allow more useful optimization, beyond just whether or not an event occurred. This parameter choice takes into account both privacy and utility, and could be increased/lowered as necessary to support varying levels of optimization.

1 bit is the minimum necessary to support "complex" optimization: anything beyond just optimizing whether there was a trigger event for a given ad interaction.

Aggregatable reports have an encrypted payload and a plaintext metadata section. The recipient of the report may be able to observe side-channel information such as the time when the report was sent, or IP address of the sender. 

The plaintext portion of an aggregatable report includes information necessary to organize (batch) reports for aggregation. The encrypted portion is assumed to be not readable by an attacker (except for ciphertext size). 

Batches of aggregatable reports can be sent to a secured aggregation server that can access the encrypted payloads and produce a summary report. Data in the summary report is protected by a noisy differential privacy release mechanism. Parameters of this mechanism are left underspecified to allow for exploration of privacy and utility, and will eventually be fixed based on community feedback. 

### 2.3. How do the features in your specification deal with personal information, personally-identifiable information (PII), or information derived from them?

This API does not directly expose PII or personal information.

### 2.4. How do the features in your specification deal with sensitive information?
The API does not on its own vend sensitive information, however, it does allow sites to learn very small amounts of data derived from other sites.

We mitigate this disclosure by enforcing that data coming out of this channel is aggregated with additional noise. In principle, this framework can support specifying a noise parameter which satisfies differential privacy.

### 2.5. Do the features in your specification introduce new state for an origin that persists across browsing sessions?
Yes, we introduce a new storage space for attribution sources and triggers that persists across browsing sessions.

### 2.6. Do the features in your specification expose information about the underlying platform to origins?
No

### 2.7. Does this specification allow an origin to send data to the underlying platform?
If so, what kind of data can be sent?

No

### 2.8. Do features in this specification allow an origin access to sensors on a user’s device
If so, what kind of sensors and information derived from those sensors does this standard expose to origins?

No

### 2.10. Do features in this specification enable new script execution/loading mechanisms?
Yes, it adds a new attribute and JS API in which the browser will fetch a provided URL.

### 2.11. Do features in this specification allow an origin to access other devices?
No

### 2.12. Do features in this specification allow an origin some measure of control over a user agent’s native UI?
No

### 2.13. What temporary identifiers do the features in this specification create or expose to the web?
For event-level reports, the API exposes a temporary identifier in the form of <impression metadata, conversion metadata> i.e. the information in a conversion report. It is only exposed in a non-credentialed request to the reporting domain, and not to any Javascript. The impression metadata is set by a publisher site, and the conversion metadata is set by an advertiser site. Those metadata values on their own are able to be stored in first party storage and there is no way for the browser to enforce rotations or limits on them.
The impression metadata associated with an ad click persists for the expiry window (max 30 days) of the clicked impression, and can potentially be re-used in some small number (e.g. <= 3) conversions.
The stored information associated with an ad click is cleared when the user clears state in their user agent.

### 2.14. How does this specification distinguish between behavior in first-party and third-party contexts?
Use of this feature in third party contexts requires a Permissions Policy:
https://wicg.github.io/conversion-measurement-api/#permission-policy-integration

### 2.15. How do the features in this specification work in the context of a browser’s Private Browsing or Incognito mode?
The intent of the design is not to send any information generated in Incognito mode. In general, this API can operate in incognito mode with a separate partitioned storage, or be disabled wholesale in incognito without it being an “incognito detector” (e.g. by just dropping reports silently).

### 2.16. Does this specification have both "Security Considerations" and "Privacy Considerations" sections?
We’re still working on the spec’s initial draft. It will include both of these sections.

### 2.17. Do features in your specification enable origins to downgrade default security protections?
No

### 2.18. What should this questionnaire have asked?
N/A
