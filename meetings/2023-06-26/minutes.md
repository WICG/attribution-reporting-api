# Attribution Reporting API

June 26, 2023 @ 8am PT

This doc: [bit.ly/ara-meeting-notes](bit.ly/ara-meeting-notes)

Meet link: [https://meet.google.com/jnn-rhxv-nsy](https://meet.google.com/jnn-rhxv-nsy)

Previous meetings: [https://github.com/WICG/conversion-measurement-api/tree/main/meetings](https://github.com/WICG/conversion-measurement-api/tree/main/meetings)

Meeting issue: [https://github.com/WICG/conversion-measurement-api/issues/80](https://github.com/WICG/conversion-measurement-api/issues/80)



* Use Google meet “Raise hand” for queuing.
* If you can’t edit the doc during the meeting, try refreshing as permissions may have been updated after you loaded the page.
* If you are not admitted to the meeting, try rejoining. Google Meet has some UI that makes it easy to misclick if someone simultaneously requests to join while someone else is typing into the meeting chat.
* Please make sure to join [W3C](https://www.w3.org/) and [WICG](https://www.w3.org/community/wicg/) if you plan on participating


# Agenda



* Chair: Charlie Harrison
* Scribe volunteer: Charlie Harrison, Akash Nadan

Please suggest agenda topics here! (either in a comment or a suggestion on the doc:



* [Hidayet Aksu] [Key discovery explainer](https://github.com/WICG/attribution-reporting-api/blob/main/aggregate_key_discovery.md)
* [Charlie Harrison] ARA Basic Flexible Configs ([spec PR](https://github.com/WICG/attribution-reporting-api/pull/856))
    * [Slides](https://docs.google.com/presentation/d/1T-ayaQc9px5Iv-SUFiwRKIcYLN7WDGrCZF6bpwHw6bk/edit?usp=sharing)


# Attendees — please sign yourself in! 

(Please sign in at the start of the meeting)



1. Charlie Harrison (Google Chrome)
2. 
3. Aleksei Danilov (Criteo)
4. Matt Lamont (AdTheorent)
5. Michal Kalisz (RTB House)
6. Andrew Pascoe (NextRoll)
7. Stacy Andrade (AdTheorent)
8. Risako Hamano (Yahoo Japan)
9. Renan Feldman (Google Chrome)
10. Akash Nadan (Google Chrome)
11. Rotem Dar (eyeo)


# Notes

**Key Discovery Explainer**



* Scribe: Charlie Harrison
* Hidayet: We recently published this explainer, I will give a high level understanding
* Context
    * Attribution reporting there are two APIs: event API and aggregate API
    * Event API provides local noise, ad-techs can directly use it
    * Aggregate API encrypts data. Ad-techs provide a list of aggregation keys and the workers compute the sum of values matching aggregation keys
    * **Key discovery: aggregate API**
* Why: the problem and the pain
    * Current API expects ad-tech to input the list of domain keys. All possible keys can be large to track
    * Just listing 48 bits of keys requires 1.5 TB to list the keys
    * Current API doesn’t scale well for large domains (e.g. publisher domain)
    * Related to issue #583
* Proposed mechanism: key discovery
    * Truncated laplace + user-supplied threshold
    * Key mask → which keys to include in the output, 128 bit output space can be pruned
    * All pre-declared buckets will still be present in the output
    * For non-predeclared buckets, will be compared against key-mask and threshold. Only those matching key-mask and threshold will be considered.
    * Precision / recall tradeoff: Ad techs set the threshold to balance between precision and recall. Default threshold provides 100% precision.
    * Precision = true positive / (true positive + false positive)
    * Recall = true positive / (true positive + false negative)
* Example
    * Keep track of source site
    * Two measurement calls that use 42 bits, encodes source site as part of the key space
    * Ad tech can use agg api without listing keys
    * Key mask in this example is the rightmost 42 bits, rest unused.
    * Threshold can be computed offline
    * Ad tech can retrieve source site by looking at the relevant part of the keys
* Summary
    * Helps to work with unbounded domain file, it’s backwards compatible
    * Feedback welcome on issue 864
* Charlie: criteo dataset, more details?
    * Criteo Sponsored Search Dataset
    * Ran a colab on that dataset to figure out the optimal precision / recall tradeoff
    * Optimized for the F1 score
    * Aggregate workers are not going to explore the full 128 bit key space, we will share the exact optimized algorithm
* Michal Kalisz: are we finalizing any epsilon / delta values?
* Hidayet: we haven’t finalized this, we are hoping for feedback. For the experiment I used delta 10^-8, and epsilon=10.
    * We have an open issue to gather feedback: [https://github.com/WICG/attribution-reporting-api/issues/485](https://github.com/WICG/attribution-reporting-api/issues/485)
    * We are not at the point where we are limiting to a particular epsilon value
* Alexey Danilov:
    * Any plans on implementing this?
* Hidayet: current plan is to implement this in the local testing tool
    * Depending on the feedback, we can think about implementing in production
* Renan: right now we are exploring this so not committing to fully implementing. When we make more plans we will be happy to let you know. This is an exploration phase.
* Alexey: This goes in the direction of some things we were askin for on the criteo side, we are definitely interested
* Michal Kalisz: also interested from my side. This is only related to aggregation service right? So it would work for ARA and Private Aggregation API.
* 

**ARA Basic Flex Configs**



* Scribe: Akash Nadan
* Charlie: recent spec PR #856. A first step towards the flex event explainer. Wanted to provide an overview and how it affects privacy. This is a simple way to provide value without all of the complexity
* Basic Overview
    * Forward compatible with flexible event
    * Allows configuring max number of reports (up to 20) and the number and timing of reporting windows (up to 5).
    * More configurable than the current API
    * Noise will change depending on the configs that you choose to use
    * Upper limits have been set to match what we have in the flex event explainer
* How does the privacy work?
    * Goal is to match what is in the flexible event explainer
    * As you increase the number of outputs the amount of noise will increase (noise for a given epsilon)
    * Channel capacity: the information gain for a given configuration. How much information can be leaked for given configuration
    * If you bypass the max info gain for a source type, the registration will fail
    * The max info gain is currently TBD
    * flexible-event/flexible_event_privacy.py is a useful calculator for computing the info gain and flip probability for a specific epsilon. Can be used to figure out what a given configuration would look like
    * Similar to the flexible event explainer, except for the trigger_spec component
    * The 2 fields you set (number of reports and number/timing of reporting windows) will be global in this simple version of flex event’
* Rotem (chat): is the purpose to optimize the events reporting to those that matters the most?
* Charlie: fixed config is not useful for all use cases. Some users don’t need as many reporting windows etc. If a user only needs a smaller output space then they could get much less noise. Users can make trade offs.
* Alexey: if we keep the total number of reports as today, but only use 1 reporting window is there a benefit to noise (less noise)?
* Charlie: yes. With the flexible config you can set the one window to what you want and you would get less noise
    * Example based on spreadsheet calculator: 3-3-3 flip probability = ~0.24%, 1-1-1 flip probability = ~0.013% noise
* Alexey: this proposal wouldn’t affect the reporting delay?
* Charlie: there are 2 aspects to this
    * Unknown delay based on user behavior such as device being off or user clearing their data
    * Additional 1 hour tacked on by the API. There will be +1 hour to all reporting windows and this will continue with the flexible configs as well
* Charlie: we have noticed that setting smaller windows helps with the offline client issue
* Charlie: any additional questions/comments?
* Michal: questions regarding reporting origin: 
    * we have 3 reporting origins
    * 3 origins used for creating interest groups in Fledge
    * Is there a case where origin of renderURL is different then the register beacon origin from fenced frame. If the origin of ad is different from register beacon, we saw that the attribution source is not registered even if the attribution eligible header is there
    * If the origin for renderURL and register beacon are the same, then the registration is successful
* Charlie: would be best to file a github issue or chromium bug to make sure we are getting all of the details. But this might be possible for us to support. This might be a configuration bug or a bug on our end
* Michal: question regarding current max origin per reporting site limit of 1
    * If we display 2 origins on the same publisher will it be blocked? yes
    * Is it possible to increase this value to 3
* Charlie: This is really helpful feedback. Could you file a github issue or respond to the [github issue](https://github.com/WICG/attribution-reporting-api/issues/725) regarding this explaining why you need 3 and the legal reason behind this. We want to make sure we understand what scenarios we might be breaking with this change
* **End of meeting**
