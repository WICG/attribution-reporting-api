# Attribution Reporting API

Tues Sep 12, 2023 @ 14:30 CEST

This doc: [bit.ly/ara-meeting-notes](bit.ly/ara-meeting-notes)

Meet link: [https://meet.google.com/jnn-rhxv-nsy](https://meet.google.com/jnn-rhxv-nsy)

TPAC 2023 zoom link

Previous meetings: [https://github.com/WICG/conversion-measurement-api/tree/main/meetings](https://github.com/WICG/conversion-measurement-api/tree/main/meetings)

Meeting issue: [https://github.com/WICG/conversion-measurement-api/issues/80](https://github.com/WICG/conversion-measurement-api/issues/80)



* ~~Use Google meet “Raise hand” for queuing.~~(not for TPAC, instead) use the Speaker Queue just below the Attendee List.
* If you can’t edit the doc during the meeting, try refreshing as permissions may have been updated after you loaded the page.
* If you are not admitted to the meeting, try rejoining. Google Meet has some UI that makes it easy to misclick if someone simultaneously requests to join while someone else is typing into the meeting chat.
* Please make sure to join [W3C](https://www.w3.org/) and [WICG](https://www.w3.org/community/wicg/) if you plan on participating


# Agenda



* Chair: Charlie Harrison
* Scribe volunteer: Christina Ilvento

Please suggest agenda topics here! (either in a comment or a suggestion on the doc:



* [csharrison]: extensions / upcoming features / general discussion
* 


# Attendees — please sign yourself in! 

(Please sign in at the start of the meeting)



1. Aaron Selya (Google Chrome)
2. Alex Cone (Google Chrome)
3. Alex Koshelev (Meta)
4. Alexandru Mihai (eyeo)
5. Aloïs Bissuel (Criteo)
6. Chris Fredrickson (Google Chrome)
7. Christina Ilvento (Google Chrome)
8. David Dabbs (Epsilon)
9. Elias Selman (Criteo)
10. Erik Taubeneck (Meta)
11. Fabian Höring (Criteo)
12. Guy Teller (eyeo)
13. Isaac Foster (MSFT Ads)
14. Joey Knightbrook (Snap)
15. Lei Zhao(China Mobile)
16. Lionel Basdevant (Criteo)
17. Michael Kleber (Google Chrome)
18. Nicola Tommasi (Google Chrome)
19. Paul Farrow (Microsoft)
20. Phillipp Schoppmann (Google)
21. Richa Jain (Meta)
22. Sarah Nogueira (Criteo)
23. Sven May (Google Privacy Sandbox)
24. Tab Atkins-Bittner (Google)
25. Taiki Yamaguchi (Meta)
26. Tammy Greasby (Anonym)
27. Tsuyoshi Horo (Google Chrome) 
28. Viacheslav Levshukov (Microsoft Ads)
29. Wojciech Filipek (eyeo)
30. 
31. 


# Speaker Queue



* 
* 


# Notes

Charlie H: Presentation for the first half, discussion for the second. Please correct notes/help out due to audio issues in the room. Agenda for today: recent changes to ARA that are shipping soon, some high level proposals and extensions seeking feedback, some smaller feedback items, then open discussion.

Charlie H: Recent changes: things that we’ve already implemented in Chromium, you should be able to see them soon in Chrome. “Lite” flex event configurations. Working on an overall high level plan to make the event configuration for ARA more flexible. We’ve implemented phase one, which we’re calling “lite” flexible configurations. Se PR 856. What you can do with this new feature is say for each event how many reports it can generate. Previously, views were fixed at one, clicks at three. Additionally, used to have fixed reporting windows for when reports would arrive. Example: clicks has an initial window of 2 days, later conversions would be pushed to the next window. This is now configurable, you can specify a set of “n” times to schedule reports. New parameter for max event level reports, which defaults to 3, but you can set it to something else. Interesting property of the design, depending on how you configure the source, the privacy of the API will potentially change, so instead we fix the privacy in terms of a DP epsilon parameter, so if you configure your output to be coarser, uses less noise. Fewer reports will give you less noise, likewise fewer reporting windows will give you less noise. The opposite is also true. If you’ve used the API and you want clicks to have less noise like views, you can use the same configuration across views and clicks. We are shipping this in Chromium version 117. 

Charlie H: Seeking feedback: current proposal changes the noise to fix a single DP epsilon, but we also have another measure of privacy “channel capacity” or “information gain”. Right now, we’re rejecting configurations that exceed a given information gain, interested on feedback on whether we should scale noise so that this constraint is satisfied. Can share the formulas for how this would look. The main reason we didn’t do this is that there’s potential for very high noise and you might get more than you expect. Script available on the repo that will tell you what the information gain is for a parameterization, can use this to see if the parameterization you want is feasible.

Charlie H: new feature called “lookback filters” PR 914. Existing API has a field called source expiry, when a source is expired, it’s no longer eligible for attribution. If all of your sources have the same expiry, this can be used to implement a conversion lookback window, which is a property of the conversion. Because this is a property of the conversion, not the impression, it’s something that is missing in the expressivity of the attribution matching in the API. We’ve tried to support this by using the existing filtering mechanism in ARA. Right now, for source registration you can manually specify filter data and filter out sources that have or don’t have particular filter data at conversion time. We’ve implemented a reserved field that you can match on called “_lookback_window” and if it’s set you’ll ignore sources that were set before the specified duration. We’re hoping this satisfies the lookback window use-case and provides more expressivity than source expiry.

Charlie H: Proposals and extensions, don’t know for sure if we’re going to implement it, more early stage and not specified yet. First is fully flexible event-level configurations. This allows you to do things like learn about return on ad spend, which is difficult to do now with the small cardinality of trigger data. This allows you to bucket values and output sums. So you would get a different event-level report for each new bucketized value the user generates. This also allows you to support larger count values. Right now, even with the “lite” flexible config, you can only learn the number of conversions, but the more you add, the higher the noise gets. You can learn more counts if you use bucketing, so this system also supports that feature. You can get both count and value buckets. You can also specify these based on the conversion type, using the trigger data field. So if you have a purchase conversion category, you can learn about bucketed values for just purchases, but if you have an email signup, you don’t have to use the bucketing for that. It allows you to carve out the output space of the API precisely based on conversion type, so that you can spend the least amount of noise and hopefully optimize the output to maximize accuracy. 

Charlie H: this is also integrated into the simulation library we’ve launched, which is a java library that simulates the behavior of the API. Not in Chromium yet, but you can see it in the simulation library, in the process of specifying this behavior.

Charlie H: Aggregatable reports with 0 delay, a follow up to a previous discussion. (Issue 974). This proposal came out of the previous discussion where we were brainstorming how to further reduce the delay on aggregateable reports. Current implemented behavior for aggregate reports is that there’s a delay of up to 10 minutes after the conversion before sending the report. This is a proposal to remove the delay and get the report instantaneously. There are different ways you could opt into this, we’re using a trigger_event_id for this; the report would come immediately, and would include the trigger_event_id in the clear. So you would be able to tie the report to the context that generated it. This idea was previously brainstormed when we published the explainer for report verification, hypothesis at the time was that the privacy costs for this would be too high, but that might not be true. The privacy cost seems to be that we need to send this report unconditionally, even if there were no previous sources. So this would just be encrypted contributions of zero, act like null reports. Reason to add these is that otherwise the presence or absence of the report will leak some amount of cross-site data (leaks that you saw an ad/clicked an ad previously on another site). 

Charlie H: Issue 974 has some formulas to estimate scale of null reports you can expect; not something Chrome can compute because this is based on the rate users convert. If 100% of the time users see ads, they convert and otherwise they never convert, this will be the same as today. But if there are a lot of conversions when users don’t see ads, you can get a higher scale of null reports. 

Erik T: What do we expect the cardinality of null reports to be? Do the numbers have to be in a certain direction or scale for this to be enabled? Is the decision in Chrome or on the user of the API.

Charlie H: Assuming we implement this, it’s on the caller of the API to decide what they want to do, there would be an opt-in mechanism. That being said, if no one says this feature is interesting and that the cost is too great, then we won’t implement this. Looking for feedback to guide if we should implement this. Previous call, multiple people said this was interesting, but need to get to the next step with understanding the null reports.

Erik T: Is the opt-in global or per event.

Charlie H: Per event, on trigger registration you provide the id to opt in.

Kleber: Is this a case where other attribution APIs we’ve been talking about in PATCG already have this, so the addition of this feature moves ARA closer to the behavior of the other proposals?

Charlie H: Sort of. If you’re familiar with the PAM proposal from Apple webkit, they have a similar architecture on their aggregatable reports where as soon as there’s a conversion, the report is generated immediately. However, those reports are sent immediately for aggregation and not sent to the ad-tech with an identifier. We think that sending to the ad-tech with an identifier is good, it allows ad-tech to filter out events that they may think are spammy or fraudulent. So if you wanted to wait a few hours to see if a trigger ID really leads to a verifiable purchase before interacting with the aggregation service only on the reports that seem legitimate. So this is a proposal both to reduce the delay, and also helps with anti-fraud to be able to run an offline filtering system before talking to aggregation service. For IPA, you can do offline filtration by filtering out the raw conversion events before running attribution; it’s a little more expressive because you can filter out pre attribution which could allow “good” conversions to later be matched, but it’s pretty similar.

Erik T: Other proposals see the reports being conditional with a delay as leaking more vs sending unconditional.

Charlie H: It’s a privacy win if this is the default, not really if it’s an option. Depending on other options in the API, you’ll either get null reports at a rate of 5-30%.

Charlie H: one caveat not in the slides, feature of the aggregatable reports is including the source registration time, optionally allows you to include the day of the matched source. This is the field that changes the rate of noise. In the proposal, we propose not including this, because this could require sending 30 null reports for each unattributed conversion. Feedback on this would be useful. If you’re using the source registration time feature and you would like to use the zero delay, please provide this feedback.

Isaac: Is there a schedule?

Charlie H: Not yet, looking for feedback to prioritize implementation, please provide feedback on the issue.

Charlie H: Custom shared ID labels and requerying. Issues ARA 732 and PAA 92. If you’re familiar with the aggregation service, we have a parameter which is called the “shared id” which is how we implement no duplicates rule. We never want to process a report more than once, because if you can process over and over again, you can average out the noise and we lose privacy protections. We implemented as a performance improvement to the agg service to batch many reports together and just keep track of how many times the batch has been queried. This proposal allows you to add a custom label to this batch which allows you to split up the batch into smaller disjoint pieces, so you can process them separately without violating the no duplicates rule.  Trying to align with the PAA proposal. This composes well with the zero delay proposal, because you could use the trigger identifier to label the reports and you’ll be able to filter out the subset of reports that have this label. This lets you more flexibly choose which reports you want to batch together. 

Charlie H: We’re also considering extending the no duplicates rule to bounded duplicates. So you could specify that you want to use a batch 2 more times, so please give more noise on this query. So privacy for the user is preserved, but you can query in a more flexible way. This could be useful if you want to make daily queries each day and then a weekly query at the end of the week. 

Charlie H: Aggregate debugging. Today in the API we have verbose debug reports that rely on you presenting a 3rd party cookie with a specific name, ar_debug. The reason why we rely on this signal is because the verbose debug reports don’t have good privacy characteristics, we just implemented this to make adopting the APIs easier while you have 3P cookies. What do we do when 3PCs go away, we’re proposing aggregate debugging. We have an enumerated list of error codes, and we have a proposal to include those error codes in aggregation keys augmented with context about the source and trigger (bitwised ORed with the error code), so you’ll be able to learn things like a histogram of error codes per campaign. Allows you to generally create histograms of errors. We understand that it’s less flexible than the verbose debug reports that are sort of 3PC equivalent, but hopefully this allows for some error detection.

Charlie H: Key discovery: One other proposed extension is based on the idea of key discovery we’ve been talking about for a while. Hidayet previously presented about this in the WICG and we wanted to discuss further because we hadn’t gotten much feedback on the proposal. The idea is that we can slightly change the notion of privacy (from epsilon to epsilon-delta) we’re using in the agg service by changing from Laplace to truncated Laplace. Can compose this noise distribution with a threshold to bound the expected number of false positives from the API, so you can make queries without pre-specifying the domain of aggregation. Right now, you have to list out all of the aggregation keys that you want to aggregate over. This can be error prone or you may not know all the keys you want to aggregate over a priori. This allows you to just ask for keys over a given threshold. If you choose a reasonable threshold, you can get essentially only true positives. Can also tune the threshold value further, see explainer for details. We think that this is the start to supporting more features like higher cardinality keys, although we’ve also considered including source site, etc in the aggregation keys. Feedback on this proposal would be quite useful, this involves pretty major changes to aggregation service, so we’d like feedback on this.

Charlie H: Smaller feedback items. Destination limit is currently 3, we allow you to specify 3 destinations (etld +1) for which each source can convert. Increasing this limit isn’t necessarily privacy neutral, but we’re interested if there are use cases where different numbers would make sense. The privacy attack by increasing this is that if there’s a group of sensitive sites where you don’t want to leak if you went to any one out of any of them, increasing the limit allows this set to get larger and larger. 

Charlie H: filters on aggregatable values (issue 649). We allow filtering on the aggregatable trigger data, but we don’t allow this on aggregatable value, and we currently limit to 20. Not clear if this is needed, please provide feedback on the issues.
