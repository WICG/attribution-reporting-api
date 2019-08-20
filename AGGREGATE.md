# Conversion Measurement with Aggregation Explainer

# Introduction

This document is an explainer for extensions to our existing [event-level conversion measurement API](https://github.com/csharrison/conversion-measurement-api) explainer. The intention is to provide mechanisms for information about conversions to be reported in a way that reporting endpoints can only learn _aggregate_ data, not any data associated with a particular click or user.

In this way, we can satisfy use cases for which an event-level API would reveal too much private information.

Note: this document does not currently propose a concrete API or technology. We instead survey interesting tools and techniques that might be composed to satisfy the API goals.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

- [Privacy Goals](#privacy-goals)
- [Use Case Goals](#use-case-goals)
    - [Richer conversion metadata](#richer-conversion-metadata)
    - [Better accuracy](#better-accuracy)
    - [View-through conversions](#view-through-conversions)
- [Design Goals](#design-goals)
    - [Simplicity](#simplicity)
    - [Parallel reports alongside event-level API](#parallel-reports-alongside-event-level-api)
    - [Fraud protection](#fraud-protection)
    - [Consideration for multiple privacy settings](#consideration-for-multiple-privacy-settings)
- [API Topologies](#api-topologies)
  - [Intermediary server infrastructure](#intermediary-server-infrastructure)
  - [Query-based / non-query-based](#query-based--non-query-based)
- [Techniques and Technologies](#techniques-and-technologies)
  - [Authentication & Anti-fraud](#authentication--anti-fraud)
    - [Blind Signatures](#blind-signatures)
  - [Confidentiality](#confidentiality)
    - [Threshold cryptography](#threshold-cryptography)
    - [Multi-party computation](#multi-party-computation)
    - [ESA Architecture](#esa-architecture)
    - [Anonymity Cohorts and Secure Aggregation](#anonymity-cohorts-and-secure-aggregation)
    - [Local Differential Privacy](#local-differential-privacy)
    - [Low-entropy identifiers](#low-entropy-identifiers)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# Privacy Goals

The high-level goal of the API and proposed privacy infrastructure is to make conversion reports anonymous and unlinkable to individual users or clicks. Certainly it must be impossible to use the API to de-anonymize users at scale, but additionally, it should not be possible to attribute any event-level activity (on either the publisher or advertiser site) to any specific user. Ensuring reports meet certain aggregation thresholds or providing only low-entropy identifiers (similar to WebKit's proposed [Ad Click Attribution API](https://github.com/WICG/ad-click-attribution)) are two examples of techniques that could be useful here.

Additionally, our goal is that any auxiliary server-side infrastructure used in the API should be minimally trusted.

# Use Case Goals

The aggregate measurement API should support legitimate measurement use cases not already supported by an event-level API. Note that based on the privacy constraints of this API, some of the following use-cases may come into conflict if their combined data needs cause reports to be highly identifying.

### Richer conversion metadata
The event-level API greatly restricts the amount of conversion metadata, because it is linkable directly with click-level identifiers. The aggregate API can relax this constraint without compromising on privacy, and allow for richer metadata like reporting conversion value at the campaign level, something not possible with the event-level API. This richer metadata allows an advertiser to more accurately compute their return on investment, and for publishers to monetize their sites more effectively.

### Better accuracy
This API should give high-fidelity measurement of conversions. The reports it generates should produce more faithful results than e.g. the noisy conversion values in the event-level API.

In the event-level API, impressions are also limited to converting a small number of times. The aggregate API should allow advertisers to get more accurate counts of how many conversions there were for a campaign.

The accuracy of multi-touch modeling (many impressions for the same conversion) can also be improved. In the event-level API, multiple cross-site impressions targeting the same conversion cannot be associated together, making analysis based on the entire click “path” difficult. This API should support measurement of these conversion paths.

### View-through conversions
There is a large class of impressions that are expected to be viewed but rarely clicked, for instance, pre-roll video ads. An aggregate conversion measurement API could be used to satisfy some of the measurement needs of these ads.

# Design Goals

### Simplicity

These technologies are complex. We should try to build the simplest solutions that satisfy the privacy and utility goals.


### Parallel reports alongside event-level API

If the [privacy goals](#Privacy-goals) of the API are met, it means that we could extend the event-level API with this one, potentially sending parallel aggregate reports alongside event-level reports (as long as the reports are not otherwise associated with each other).

This greatly improves the usability of the API, allowing for many other [use cases](#Use-case-goals) that aren’t possible with just the event-level scheme


### Fraud protection

Aggregate conversion measurement is much more susceptible to fraud than event-level measurement. This is because by their nature, reports cannot be tied back to any browsing context that generated them, so they are easily forged or replayed without additional protection.

Our design should strive to provide strong fraud protections while still preserving privacy.


### Consideration for multiple privacy settings

A single, global policy for conversion measurement might not satisfy all use cases, especially across sites with different usage characteristics (i.e., low vs high traffic sites). We should consider solutions that enable the API to be usable for a broad class of sites. Additionally, the API and mechanisms should support scenarios where a higher volume of reports can have stronger-than-default privacy levels.


# API Topologies

There are a few very high-level independent decisions we could make on how ad technology interacts with an aggregate measurement API.


## Intermediary server infrastructure

To augment an API that provides aggregate-only data, the browser client can optionally communicate with auxiliary server infrastructure to enhance aggregation techniques. There are a few options here to consider:



1.  **No intermediate servers are used**. In this case, the browser has to rely on local-only techniques to preserve privacy, like adding noise or sending very low entropy identifiers. These techniques attempt to make measurement on the server side aggregate-only.
1.  **Browser to server interaction only**. In this case, the intermediate server infrastructure is merely auxiliary to the browser, and doesn’t form an API surface with end users or developers. This kind of interaction could, analogous to key servers, provide cryptographic capabilities to the API. This topology strengthens otherwise local-only schemes such as [threshold crypto schemes](#threshold-cryptography), which enable values to remain hidden until they reach aggregation thresholds.
1.  **Ad tech interacts directly with a server**. In this case, intermediary servers act as semi-trusted middlemen between browsers and ad tech where results are aggregated. Servers may send the results periodically to ad-tech companies in a pub-sub API. Alternatively, ad tech may query these servers directly in a query-based API to receive aggregate reports. These ad-tech queries may optionally trigger a cryptographic protocol between the ad tech and the intermediate server, such as [private set intersection](https://eprint.iacr.org/2019/723) or [private information retrieval](https://en.wikipedia.org/wiki/Private_information_retrieval), that can strengthen privacy and/or reduce trust in the intermediate server.

Of these models, it seems like (3) is the least aligned with existing web platform API surface, especially combined with a [query-based](#query-based-/-non-query-based) API (i.e. a developer needs to query some public resources to learn their analytics). (1) is simple to understand but it isn’t clear it can satisfy the desired use cases and privacy goals simultaneously.


## Query-based / non-query-based

A query-based API would allow advertisers and ad tech to create queries and receive anonymized results based on that query. This has a large number of implications and has two main implementation choices: data kept on device, and data kept in a trusted clearinghouse.

When data is kept on device, browser clients would receive queries and compute results. All known [techniques](#techniques-and-technologies) that support client-side querying require participation in a multi-round protocol within an anonymity cohort of many clients simultaneously.

When client data is kept in a clearinghouse, it removes some need for complex on-device protocols, but may require other techniques like [multi-party computation](#multi-party-computation) to avoid requiring too much trust in the clearinghouse.

In a non-query-based API, server infrastructure computes fixed aggregated data which is eventually sent to advertisers. In this case, the “queries” are essentially preset and cannot be dynamically created by advertisers or ad tech. While this leads to a less flexible API for developers, it grants more flexibility in API design and architecture since auxiliary storage doesn’t need to contain any event-level data.


# Techniques and Technologies

There are several tools that can be leveraged to design solutions which meet the above privacy goals with different sets of trade-offs in terms of communication, computation, and trust assumptions. Next we overview these techniques and discuss their pros and cons.

We identify two core challenges that we need to address in privacy-preserving solutions: authentication for input providers (this provides a mechanism to restrict who can contribute inputs to the computation, for example, by incorporating trust signals for the participants in the computation), and privacy for input providers (conversion reports should preserve individual user privacy).


## Authentication & Anti-fraud

As measurements become increasingly confidential and privacy-preserving, advertisers and ad tech lose critical signals used to [combat fraud](#fraud-protection). A few rogue clients can start affecting the aggregate measurements of many more honest clients. Therefore, a report authentication scheme is an important aspect of any aggregate measurement API and should be considered as a first class citizen in our constructions.


### Blind Signatures

One approach to the authentication problem is to use anonymous trust tokens which could allow sites to verify properties about a user (i.e. they saw an ad, or made a purchase) while preserving their anonymity. Verifiable oblivious PRFs (VOPRFs) used in Cloudflare’s [Privacy Pass](https://privacypass.github.io) and [blind signatures](https://en.wikipedia.org/wiki/Blind_signature) are two cryptographic tools that can be used to instantiate trust tokens. These tokens have the following useful properties:

*   Unlinkability: A token issue event cannot be linked to a later token validation event.
*   Unforgeability: A token cannot be forged by a third party.

In order to provide this guarantee, the browser blinds a nonce before sending it to the server, which then signs the blinded token. The client can then unblind the token locally and store it, resulting in a nonce and valid signature that has not been seen by the server. The security properties of the construction means that additional tokens can't be fraudulently created without requesting more tokens from the server.

Later on, the unblinded nonce and signature can accompany the conversion report, and the endpoint can verify that they did indeed sign the nonces, but there is no way that they can be associated with the blinded versions they saw before.

Metadata can be associated with the conversion report and signed over through a number of extensions. The metadata can be either visible (such as an accurate timestamp) or hidden to the user (such as a reputation bit). Care must be taken to ensure that the server can't use metadata to de-anonymize reports. This is done either by enforcing strict limits on the bits of information at disposal, or by composing other aggregation techniques.

These sorts of ideas are also being explored in slightly different context at https://github.com/dvorak42/trust-token-api/, and by Facebook at https://github.com/siyengar/private-fraud-prevention.

**Pros**
*   Allows for checking integrity of a conversion report without revealing any user identity
*   In addition to providing infrastructure for checking integrity, the underlying cryptographic primitives in such a scheme can also be used to strengthen the confidentiality of user reports when used with some of the technologies discussed in the [Confidentiality section](#confidentiality), especially, [threshold cryptography](#threshold-cryptography).

**Cons**
*   Requires a server to handle the issuance and redemption of many tokens
*   Requires potentially fraudulent requestors to be determined at the issuance time

**Conclusion**: This technique provides unique and critical functionality without sacrificing privacy. We should attempt to compose it with some of the other ideas below.


## Confidentiality


### Threshold cryptography

Threshold cryptography enables the protection of a client value until there are sufficiently many clients reporting the same value.

This can be achieved by having a unique key associated with each possible value, which each client uses to encrypt the corresponding value that is reported by the browser, together with a [Shamir Secret Share](https://en.wikipedia.org/wiki/Shamir%27s_Secret_Sharing) of the key. This guarantees that a value can only be decrypted if it has been reported by a minimum threshold of clients.

If the client values have sufficient entropy the encryption keys can be derived directly from these values (See Section 4.2 of the [Prochlo paper](https://arxiv.org/abs/1710.00901) for more). Otherwise, the clients can run a key generation protocol or use designated parties to hold shares of the key and aid the protocol.

**Pros**
*   Absent an intermediary server, all computation is done locally by the browser, and the server that receives conversion reports does not need to be trusted
*   An intermediary server strengthens privacy guarantees and requires minimal trust (that it runs a protocol correctly)

**Cons**
*   Can recover counts with blinded labels (i.e. the encrypted values) even if thresholds are not met
*   If the intermediary server is untrusted, it potentially requires more expensive computation on the client to mask values
*   There is a tradeoff between the amount of entropy required in the values and the complexity of the protocol, as the simplest protocol derives keys from the values themselves

**Conclusion**: Threshold crypto is a useful technique for computing a value and its associated COUNT. It is less effective at computing more sophisticated aggregate functions like SUM, but we encourage research in extending the functionality of such technology.


### Multi-party computation

Secure multi-party computation is a cryptographic technique that allows many parties to evaluate a function on their joint inputs revealing nothing more about their private inputs than the output of the computation.

This approach can be used directly between all clients but will require communication between them, which is difficult absent things like P2P networks. A different approach adopted by the MPC system [Prio](https://crypto.stanford.edu/prio/) used in Firefox is to assume that there are two main computation servers that are trusted not to collude with each other. Clients share their inputs between the two computation parties, which can evaluate any aggregate statistics without learning anything about the parties’ inputs.

There are many other approaches to designing MPC protocols for computing privately aggregate statistics that assume different communication and computation capabilities for all participants.

**Pros**
*   No single point of failure for privacy
*   One piece of client data is never stored on a single machine/server
*   Only a subset of parties involved need to be trusted to maintain privacy characteristics

**Cons**
*   Each party is a potential point of operational failure
*   If parties collude, privacy can be compromised
*   Other parties involved in the MPC would need to be able to support running servers at the scale of browsers (billions of users with high QPS/storage requirements), perhaps there is a valid system that allows servers to run at different scales
*   The complexity of computation is multiplied by the number of statistics being computed

**Conclusion**: Multi-party computation across different servers is a useful primitive in scenarios that allow for distributed trust. Particularly so, if solutions would otherwise require trusting an individual party too highly.


### ESA Architecture

Google researchers published the [Prochlo paper](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/46411.pdf) describing the Encode-Shuffle-Analyze architecture, which offers attractive tradeoffs between utility and privacy. The architecture is broad, high-level, and is designed to incorporate several technologies described above. Briefly, it states that data collection from users should be partitioned into three distinct phases with their own set of technologies and privacy guarantees.

*   Encode: local (client-side) modifications to data, such as aggregation, compression, adding noise for local differential privacy, and incorporating other advanced privacy-preserving encoding schemes such as threshold encryption.
*   Shuffle: a semi-trusted middleman with a simple interface that acts as a proxy to aggregate and anonymize data forwarding it in batches to a server-side recipient called the Analyzer.
*   Analyze: Receives data from the Shuffler and can provide additional central privacy guarantees (such as private queries and release of data).

Hosting a Shuffler by a party that is incentivized to work with various stakeholders in the ecosystem to provide a clean and reliable interface with well-defined privacy guarantees can be used in conjunction with other ideas presented here (such as bootstrapping [Multi-party Computation](#Multi-party-Computation) or acting as a transport layer for [Federated-Learning based techniques](#Anonymity-Cohorts-and-Secure-Aggregation)).

**Conclusion**: ESA is a useful privacy framework to build upon: many of the ideas listed in this document can fit within ESA to create an end-to-end solution.


### Anonymity Cohorts and Secure Aggregation

Google research published a paper ([Practical Secure Aggregation for Federated Learning on User-Held Data](https://ai.google/research/pubs/pub45808)) that presents a protocol for secure aggregation. This protocol enables multiple clients that have vector inputs to compute and reveal to a server their vector sum without revealing anything more about the inputs to the server. It only requires communication channels between each client and the server (not client to client), and is also resilient to a threshold number of client dropouts during the execution of the protocol.

The main idea behind this construction is to have the clients share pairwise keys that enable them to mask their inputs in such a way that the masks are cancelled out only when all inputs are added together.

**Pros**
*   End server need not be fully trusted
*   Can separate key exchange responsibilities from aggregation, across multiple parties
*   Highly flexible: supports rich, dynamic queries across data stored on-device

**Cons**
*   Complex, multi-round protocol
*   Difficult to align with a web model, i.e. clients should not participate in a protocol if users are not visiting a page that wants to join
*   While the protocol is resilient to some dropouts, a web-based API may have higher than normal dropout rates, as a client should drop out if the user closes the associated tab

**Conclusion**: Secure aggregation provides great flexibility at a cost of higher complexity.


### Local Differential Privacy

Local differential privacy refers to a class of techniques where data is (differentially) private when it leaves the device. In practice, this means that conversion reports need to be sent through a noisy process that can randomize metadata as well as drop (and spuriously add) reports. Some examples of local differentially private techniques are [RAPPOR](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/42852.pdf) or [TreeHist](https://arxiv.org/pdf/1707.04982.pdf).

**Pros**
*   Requires no server-side infrastructure

**Cons**
*   Without enough noise, privacy is not protected
*   With too much noise, all useful signal is lost
*   Ads data have an extremely diverse set of distributions, so data based on global frequency distribution estimates are not very useful.
*   Different advertisers operate at completely different scales (i.e., one advertiser can have 10x the conversion rate of another) rendering the application of local DP challenging

**Conclusion**: Local differential privacy likely cannot provide sufficient utility by itself in all scenarios without sacrificing privacy. It can be composed with other techniques listed or in scenarios requiring simple statistics over large amounts of data.


### Low-entropy identifiers

This simple idea is the basis behind the [Ad Click Attribution API](https://github.com/WICG/ad-click-attribution) proposal. A conversion report can only contain low-entropy ids on the impression side and conversion side. This forces users of the API to aggregate on higher-level aggregation keys like campaign id, rather than user or click ids.

**Pros**
*   Requires no server-side infrastructure
*   Very simple to implement and understand

**Cons**
*   Low-entropy ids alone don’t fully protect a user’s anonymity, especially if a site is only targeting a small number of users to de-anonymize
*   Low-entropy identifiers may not offer enough data to satisfy the use cases

**Conclusion**: Low-entropy identifiers mitigate privacy leakage to an extent, but likely cannot provide sufficient utility with robust privacy by themselves. It’s possible they could be composed with other techniques though.
