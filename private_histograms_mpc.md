# MPC Protocol for Private Histograms

Authors: Charlie Harrison, Mariana Raykova‎

# Overview

**This document describes low level technical details of a system that could implement the high level goals of [SERVICE.md](https://github.com/WICG/conversion-measurement-api/blob/master/SERVICE.md). Go to that doc if you want a higher level picture.**

In this draft, we outline a 2-helper MPC protocol that securely aggregates reports from multiple browsers while keeping data from any individual browser private.

The basic functionality is that all browsers are reporting input records of the data: 
```
{string aggkey: int value}
```

The MPC protocol should return output that allows computing the counts and sum(value) for every aggkey:
```
{
    string aggkey: {
        int sum_value,
        int count
    },
    ...
}
```

The aggregate output from the secure computation will have privacy protected with differential privacy. The doc explores two MPC protocols: a basic protocol and a more refined one that has better privacy properties in the event of a misbehaving helper server.


# Properties we want to achieve

At a high level, we want the output of the mechanism if executed honestly to achieve differential privacy for the:
*   value sums for each aggkey
*   counts for each aggkey

However, we also want those properties to hold (or be gracefully reduced) in the event one helper is malicious. For now our threat of a malicious helper is one which logs all intermediate data in the computation for later analysis, and shares with the server receiving the aggregate output.

[Input authentication](https://github.com/WICG/conversion-measurement-api/blob/master/SERVICE.md#authenticating-inputs) is out of scope for this doc, for now.


# Primitives and notation
*   E<sub>k</sub>(v): Authenticated public key encryption of value v with key k
*   HE<sub>k</sub>(v): Homomorphic encryption with respect to multiplication (e.g. [El Gamal](https://en.wikipedia.org/wiki/ElGamal_encryption)) with public key k and over value v.	
    *   The key property we use is the fact that HE<sub>k</sub>(v)<sup>s</sup> =HE<sub>k</sub>(v<sup>s</sup>)
*   Encrypting over multiple concatenated values is notated by commas E<sub>k</sub>(v1,v2,...)
*   H(x): Hash function
    *   Used to hash x to a point on an elliptic curve to use with El Gamal encryption HE<sub>k</sub>(H(x))
*   Secret sharing
    *   Integer value = value<sup>1</sup> + value<sup>2</sup> i.e. we can split up an integer value into two random-looking secret shares.
    *   String aggkey = aggkey<sup>1</sup> xor aggkey<sup>2</sup>
*   PRF: A pseudorandom function whose output appears random


# First Attempt: Protection via Thresholding + Noise

At a high level, this protocol:
*   Browser splits up a _value_ and _aggkey_ into secret shares
*   Aggkeys are set up so that helpers can only jointly compute a PRF of the aggkeys, where the PRF keys are shared across both helpers
    *   The secret shares of the aggkeys is needed to recover the real aggkey for keys above threshold
*   Helpers sum up _value_ shares associated with each PRF(aggkey), and add some independent noise
*   Helpers count records associated with each PRF(aggkey), and add some consistent noise that is the same for each helper
*   Helpers drop records whose noisy count is below a fixed threshold
*   Helpers return, for every PRF(aggkey)
    *   sums of value shares with added per-helper DP noise
    *   the record counts with added DP noise consistent across each helper
    *   the sums of aggkey shares

## Detailed Protocol

### Step 0: Browser generates encrypted reports, sends to servers

*   Helper server broadcast public keys to browsers
    *   k1, k2 → public keys for helper 1 and 2 respectively
    *   kH1, kH2 → public keys for homomorphic encryption
*   For a single report with a given aggkey and value, browsers generate:
    *   Report for Helper 1: E<sub>k1</sub>(ID<sub>eph</sub>, HE<sub>kH2</sub>(H(aggkey)), value<sup>1</sup>, aggkey<sup>1</sup>)
    *   Report for Helper 2: E<sub>k2</sub>(ID<sub>eph</sub>, HE<sub>kH1</sub>(H(aggkey)), value<sup>2</sup>, aggkey<sup>2</sup>)
*   The party that wants to know the aggregated counts and values (e.g. the ad-tech server) collects these encrypted reports from many browsers
*   Each helper will receive a batch of these from this party
*   ID<sub>eph</sub> is an ephemeral ID used to associate records between the two helpers

### Step 1: Setup, decryption, and partial PRF computation

*   Helpers generate s1, s2 secret PRF keys
*   Helpers generate R<sub>1</sub>, R<sub>2</sub> partial random seeds
    *   These will be used to ensure noise added to counts is consistent across each helper
*   Helper decrypts all their reports in a batch
*   Helper 1 evaluates HE<sub>kH2</sub>(H(aggkey)<sup>s1</sup>) 
*   Helper 2 evaluates HE<sub>kH1</sub>(H(aggkey)<sup>s2</sup>)

### Step 2: Exchange partial PRFs and compute final PRF

*   Helpers transmit all partial PRFs to each other
    *   Helper 1 sends ID<sub>eph</sub>,HE<sub>kH2</sub>(H(aggkey)<sup>s1</sup>)
    *   Helper 2 sends ID<sub>eph</sub>,HE<sub>kH1</sub>(H(aggkey)<sup>s2</sup>)
*   Helpers hold on to ID<sub>eph</sub>, and value and key shares
*   Helpers transmit their partial seeds R<sub>1</sub> and R<sub>2</sub> to each other and each compute R = R<sub>1</sub> xor R<sub>2</sub>
*   Each helper computes AggID = H(aggkey)<sup>s1*s2</sup> which is a shared blind aggregation ID and associates it with the original report it came from
    *   Decrypt H(aggkey)<sup>s1</sup>
    *   Exponentiating AggID = H(aggkey)<sup>s1*s2</sup>
*   Associate each AggID with the original value / key shares based on the ID<sub>eph</sub>

### Step 3: Aggregation

*   Each helper computes the count of all reports C<sub>Agg</sub> for any given AggID
*   Each helper computes the sum of all value secret shares S<sub>Agg</sub> for any given AggID


### Step 4: Privacy preserving output

*   For each helper i and for each AggID:
    *   Compute S’<sub>Agg_i</sub> by adding [noise](#sums-of-secret-shares) with non-shared randomness
    *   Compute C’<sub>Agg_i</sub> by adding [noise](#counts) deterministically via the shared seed R and the AggID such that each helper computes the same noise per AggID
    *   Drop the report if C’<sub>Agg_i</sub> is below a pre-specified, fixed [threshold](#thresholds) T

### Step 5: Return data

*   Each helper i sends a list of the following values back to the calling server
    *   AggID, S’<sub>Agg_i</sub>, C’<sub>Agg_i</sub>, aggkey<sup>i </sup>(the secret share of the key with the lowest unique ID<sub>eph</sub>)
*   Server joins on AggID and sums value / aggkey shares to learn
    *   sum(value) + noise = S’<sub>Agg_1</sub> + S’<sub>Agg_2</sub>
    *   count = C’<sub>Agg_i</sub> (both helpers should return the same thing)
    *   aggkey = aggkey<sup>1</sup> xor aggkey<sup>2</sup>

## Properties
*   Can achieve differentially private output on counts and value sums if both helpers are honest
*   Values are hidden from the helper servers via secret shares
*   Keys are hidden from the helper servers via secret shares and the homomorphic encryption
*   Helpers learn true counts of keys in pseudorandom space AggID = H(aggkey)<sup>s1*s2</sup>
*   If one helper is malicious and colluding with an ad-tech
    *   See [attack](#attacks-against-this-protocol) for more details
    *   Lose differential privacy for counts for keys above the threshold (helper reveals the noise added to counts)
    *   DP with partial noise for sums of values (helper reveals their noise share added to the sums)
    *   Keys below threshold are protected by default since the honest helper never reveals the key share
    *   Keys below threshold whose records are marked by the ad-tech are **not** protected and the count is available in the clear

# Output DP analysis

For this basic write-up we will achieve record-level privacy in the output per query, i.e. consider two neighboring datasets to be ones with a record removed. We will be able to show user-level bounds when composing this service with a rate-limited client.

Every record is embedded in the output in two ways, via presence in a count and in a sum. Via simple composition we can split the epsilon budget here as eps = eps<sub>count</sub> + eps<sub>value</sub>. 

Noisy data from the API should be easy to interpret e.g. we should be able to say precisely what distribution (and parameters) the noise at the output is sampled from.

## Counts

Via removal DP the sensitivity of a count is 1, so we can achieve DP on the counts by adding Laplace(1 / eps<sub>count</sub>) to the true count.

## Thresholds

We can achieve (eps, delta) DP by choosing a threshold of 

T = 1 + log(1 / (2 delta)) / eps<sub>count</sub>

For instance, to achieve eps = 1 and delta = 10^-5, we need a threshold of ~14.
This threshold is applied to the noisy counts computed above. Since counts are consistent across helpers in this protocol, both helpers should apply thresholds consistently too.

TODO: Reference for this threshold.

## Sums of secret shares

We have a few options for the independent noise addition each helper can add to their secret shares. Since secret shares operate on a discrete domain (e.g. uint32) it makes sense to add discrete noise. We want to achieve a few properties on the noise we are adding:

*   In the “safe case” where both helpers are honest, we don’t want to add more noise than we need to protect user privacy
*   In the “malicious case” where one helper is not adding noise, we still want to be able to show reasonable DP protection if only partial noise is applied

One natural choice here is to make sure that the sum of the noise from the two helpers follows the discrete Laplace distribution (also called symmetric geometric distribution). This is explored in the paper [Differentially Private Summation with Multi-Message Shuffling](https://arxiv.org/pdf/1906.09116.pdf) (Section 4) and it entails both helpers sampling from the difference of two Polya distributions.

If only a single helper is honest, we should still be able to show DP bounds on the noise added just from sampling the Polyas, but it is an open item to compute this bound. If the privacy is non-ideal we can consider one of the alternatives below.

Note that we will always need to add noise scaled to the sensitivity of the aggregation. i.e. the input to the protocol should bound the maximum value, fixing the _sensitivity_ of the computation.

### Alternative: Each helper adds Discrete Laplace

See ([1](http://www.elaineshi.com/docs/ndss2011.pdf), [2](https://privacytools.seas.harvard.edu/files/privacytools/files/itcs.pdf?m=1516648766)) for more details. Essentially each helper samples from a two-sided geometric distribution, and the result is the sum of these two samples. However, for the same privacy this would introduce more variance on the noise than having the sum of the noise shares follow discrete Laplace.

TODO: DP bounds for noise distributed according to the sum of two discrete Laplace rvs.

### Alternative: Each helper samples from Skellam

Helpers each sample from the [Skellam distribution](https://en.wikipedia.org/wiki/Skellam_distribution) with parameter _u_ by taking the difference between two Poisson distributions with mean _u_. One useful property is that the sum of _n_ Skellam distributions with parameter _u_ is equivalent to the Skellam distribution with parameter _n * u_, making it very easy to compute DP bounds whether or not we have all the helpers honestly adding noise.

[This paper](https://arxiv.org/pdf/1710.02036.pdf) shows DP bounds for Skellam, although we may be able to compute tighter bounds.


# Attacks against this protocol

The biggest problem with this protocol is that if one of the helpers is malicious, _all_ counts associated with an AggID are revealed in the clear. In addition, the ad-tech can learn the AggID to aggkey mapping if 

*   The count for a particular aggkey is above thresholds (which can be easily manipulated by the server which inputs records)
*   The server creates false reports for target aggkeys with known ID<sub>eph</sub> values, allowing the colluding helper internally to learn the AggID → aggkey mapping for those known false reports.

So while sums are still well protected by DP in this protocol (via reduced noise), the counts of records for a particular aggkey is not well protected, and the thresholding does not provide a lot of protection for aggkeys that are guessable by the adversary.


# Refinement to the protocol: Protection via intermediate DP

We can enhance the API by including a step where the helpers first interact to insert fake / dummy records. These records will be used to ensure that event _internal counts_ associated with AggIDs are sufficiently protected via DP, but won’t affect the output at all. The only trade-off we make in this updated protocol is that we need to incur a bit more bandwidth / processing cost to deal with the fake records, and there are a few more crypto operations.

Records will now include a field _credit_ which is split into secret shares summing to 1 if the record is genuine and 0 if it is a record injected from the MPC protocol. This should ensure that fake records are indistinguishable from real records during internal helper processing.

One important point in this new protocol is that we need a domain of aggkeys to sample from, to ensure that the count for each AggID has the same protection (there is an [alternative](#Alternative-sampling-fake-records-directly-from-the-raw-records) below that does not have this requirement). A silver lining here is that by ensuring the output domain is known a priori by the helpers, we don’t need a thresholding step to achieve DP.

The output domain is communicated to the helpers in a separate message by the server, alongside the raw records.

At a high level, this protocol:
*   Other than the raw records, the servers pass the output domain of aggkeys to the helpers to allow them to compute the PRF of each aggkey
*   Splits up values and credit in the browser into secret shares
*   Aggkeys are set up so that each helper can only compute the PRF(aggkey)
*   Secret shares to be summed by a helper are given to the _other_ helper, in an encrypted form
*   This allows each helper to have a pre-processing step where they inject fake records where credit / value sum to 0
*   Helpers pass the encrypted shares as well as data to compute the PRF of the records and the output domain
*   Helpers sum shares associated with PRF(aggkey) and add independent noise to sums of credit and value


### Step 0: Browser generates encrypted reports, sends to servers
*   Report for Helper 1: E<sub>k1</sub>(HE<sub>kH2</sub>(H(aggkey)), E<sub>k2</sub>(ID<sub>eph</sub>, value<sup>2</sup>, credit<sup>2</sup>))
*   Report for Helper 2: E<sub>k2</sub>(HE<sub>kH1</sub>(H(aggkey)), E<sub>k1</sub>(ID<sub>eph</sub>, value<sup>1</sup>, credit<sup>1</sup>))
*   credit<sup>1</sup> + credit<sup>2</sup> = 1 for all records coming from browsers
*   Each helper also receives E<sub>k1</sub>(ID<sub>x</sub>, HE<sub>kH2</sub>(H(aggkey))) (or E<sub>k2</sub>(ID<sub>x</sub>, HE<sub>kH1</sub>(H(aggkey))) ) for every possible aggkey, generated by the reporting origin. This is the domain of the output e.g. all the histogram labels.
    *   ID<sub>x</sub> is an identifier for a given aggkey coming from the output domain


### Step 1: Setup, partial PRF computation, and dummy record insertion
*   Helpers generate s1, s2 secret PRF keys
*   Helpers decrypt the outer layer of encryption
    *   e.g. Helper 1 computes HE<sub>kH2</sub>(H(aggkey)), E<sub>k2</sub>(ID<sub>eph</sub>, value<sup>2</sup>, credit<sup>2</sup>)) for each record and ID<sub>x</sub>, HE<sub>kH2</sub>(H(aggkey))) for each element of the output domain
*   Helpers insert dummy records. For every element in the domain (Helper 1’s POV)
    *   Use one of the methods described [below](#intermediate-dp-analysis) to sample x, the number of fake records to insert.
    *   Iterate x times
        *   Generate new HE<sub>kH2</sub>(H(aggkey)) by rerandomizing the domain element
        *   Generate an ephemeral ID ID<sub>eph</sub>
        *   split 0 into secret shares credit<sup>1</sup> and credit<sup>2</sup>
        *   split 0 into secret shares value<sup>1</sup> and value<sup>2</sup>
        *   Generate HE<sub>kH2</sub>(aggkey)<sup>s1</sup>, E<sub>k2</sub>(ID<sub>eph</sub>, value<sup>2</sup>, credit<sup>2</sup>) i.e. the dummy record
        *   Hold on to the ID<sub>x</sub>, ID<sub>eph</sub>, value<sup>1</sup>, credit<sup>1</sup>
            *   These will be used to ensure the inverse values are added to cancel out the values from the dummy records
*   Helpers compute the partial PRF for all the true records and output domain elements
    *   i.e. generate HE<sub>kH2</sub>(aggkey)<sup>s1</sup>, E<sub>k2</sub>(ID<sub>eph</sub>, value<sup>2</sup>, credit<sup>2</sup>)
    *   and ID<sub>x</sub>, HE<sub>KH2</sub>(aggkey)<sup>s1</sup>
        *   These are used to compute the PRF of the aggkey domain and not related the records
*   Helpers transmit all the records to the other helper as well as the partial PRF of the output domain
    *   This transmission should happen in shuffled order, to ensure that the fake reports are completely indistinguishable from the real reports. This also prevents ad-tech and helper colluding to link input records with intermediate state in the protocol.


### Step 2: compute final PRF of domain and records

*   Each helper computes AggID = H(aggkey)<sup>s1*s2</sup> which is a shared blind aggregation ID and associates it with the original report it came from
    *   Decrypt H(aggkey)<sup>s1</sup>
    *   Exponentiating → AggID = H(aggkey)<sup>s1*s2</sup>
*   Decrypt the value and credit shares
*   Also compute the AggID, ID<sub>x</sub> from the output domain
*   Drop all records whose AggID does not show up in the output domain
*   Now every helper should have, for every AggID
    *   ID<sub>x</sub>
    *   A list of value and credit shares

### Step 3: Aggregation

*   Each helper computes the sum of all credit secret shares C<sub>Agg</sub> for any given AggID
*   Each helper computes the sum of all value secret shares S<sub>Agg</sub> for any given AggID
*   Each helper contribute the value / credit shares associated with the ID<sub>x</sub> for all their fake shares, since we should have a mapping of ID<sub>x</sub> → AggID at this point


### Step 4: Privacy preserving output

*   For each helper i and for each AggID:
    *   Compute S’<sub>Agg_i</sub> by adding noise
    *   Compute C’<sub>Agg_i</sub> by adding noise


### Step 5: Return data

*   Each helper i sends a list of the following values back to the calling server
    *   ID<sub>x</sub>, S’<sub>Agg_i</sub>, C’<sub>Agg_i</sub>, { ID<sub>eph</sub> }
*   The server checks that the two helpers have aggregated over the sets { ID<sub>eph</sub> } of records, and if this is not the case, aborts.
*   Server joins on ID<sub>x</sub> and sums value / credit shares to learn
    *   sum(value) + noise = S’<sub>Agg_1</sub> + S’<sub>Agg_2</sub>
    *   count = C’<sub>Agg_1</sub> + C’<sub>Agg_2</sub>
    *   The helpers should already have a mapping from ID<sub>x</sub> → aggkey


## Properties

*   Can achieve differentially private output on counts and value sums if both helpers are honest
*   Values are hidden from the helper servers via secret shares
*   Keys are hidden from the helper servers via the homomorphic encryption
*   Helpers learn noisy counts of keys in pseudorandom space AggID = H(aggkey)<sup>s1*s2</sup>. We can achieve DP on counts of keys in the output domain (see [analysis](#intermediate-dp-analysis)).
    *   Counts for keys not in the output are _not_ protected by DP, but they are also never revealed in the clear, only in pseudorandom space.
*   If one helper is malicious and colluding with an ad-tech
    *   DP with partial noise for sums of values and credit (helper reveals their noise share added to the sums). 
    *   Internal counts of records associated with each AggID is learned, artificially inflated by the fake records (can be analyzed with some  [flavor of DP](#intermediate-dp-analysis))
    *   Records that don’t come from the advertised output domain are learned in pseudorandom domain but the aggkey cannot be recovered


## Intermediate DP analysis

We can achieve DP bounds on the internal counts of records associated with a given AggID, as long as it is in the output domain. We do this by sampling fake records in the output domain and injecting them into the protocol. That is, we have a mechanism to _add_ to a sensitive count, but not subtract.

How to configure _p_ to achieve DP depends on the kind of differential privacy bounds we want to show. We have a few potential options.

### Epsilon / delta DP

The problem here is similar to the problem of [differential privacy with constraints](https://arxiv.org/pdf/2007.01181.pdf). In our case, the constraint is that the noisy count must always be greater than the true count. To achieve (eps,delta)-DP in this scenario we need to add Z fake records where: 

```
Z = s + L
s = (1/eps) log(((exp(eps) - 1) / (2 delta)) + 1)
L = Laplace(1/eps_sum) truncated to (-s, s)
```

After applying the noise, the result must be rounded to the nearest whole number in a post-processing step.

This will yield s fake records per AggKey in expectation. For example, choosing eps = ln(2) and delta = 10^-6 will yield s = ~19 expected fake records per key.


### One-sided DP

See [this paper](https://arxiv.org/pdf/1712.05888.pdf) for more information on one-sided DP. In this formulation we consider the presence of a conversion to be sensitive, and the non-presence of a conversion to be not sensitive. This may be a reasonable relaxation of DP in the event of one malicious helper.

The basic tool here will be adding fake records distributed according to a Geometric distribution.

```
P(Geo(p) == k) = p(1-p)^k
```


Consider an AggID count R and R’ that are one-sided-dp-neighbors. wlog there is only one such neighbor to consider, where R has count = n + 1 and R’ has count = n. That is, R’ is a one-sided DP neighbor of R because it consists of replacing a sensitive record with its absence.

For every x >= 0:

```
P(Geo(p) + n + 1 = x) / P(Geo(p) + n = x)
= p(1-p)^(x - n - 1) / p(1-p)^(x - n)
= 1 / (1-p) <= exp(eps)
eps = log(1/(1-p))
```

That is, we could choose p = ½ to achieve one-sided DP with epsilon ln(2), yielding one fake record per AggKey in expectation.


## Output DP analysis

The output of the refined mechanism can be analyzed based on the DP for sums of secret shares referenced above.

One important thing to note is that because our output is the entire shared output domain at the beginning, we can release credit / values for all aggkeys, including those with no true records. That is, we can remove the thresholds and still preserve DP.


## Alternative: sampling fake records directly from the raw records

If the output domain is _not_ known a priori, we can try to sample fake records from the raw records that are input from the server. That is, we can iterate through all the raw records, and use re-randomization to mint fake records that have the same underlying aggkey.

We must be careful when we do this:
*   We will never generate fake records that aren’t present in the input
*   The input records will not follow any particular distribution

What this would entail is for us to do something like sample fake records _per raw input record_ according to some distribution. E.g. sampling Geo(p) records would allow us to provide similar one-sided DP bounds on the count of any one record for records with count > 0.

For protecting the presence / absence of any aggkey, we will likely need to re-introduce the thresholding step on the count of real records + fake records though this technique will need some investigation. All of the attacks in the original protocol should be mitigated by the internal DP on the counts.

More analysis on this idea is likely needed :)

**Pros**
*   Does not require pre-sharing the output domain

**Cons**
*   Need to introduce fake records proportional to the number of records rather than the number of aggkeys, this introduces more communication and processing cost to the protocol
*   Requires thresholding to protect presence / absence of keys