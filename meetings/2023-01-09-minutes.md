# Attribution Reporting API

Jan 9, 2023 @ 8am PT (Nov 28 meeting cancelled)

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
* Scribe volunteer: Akash Nadan

Please suggest agenda topics here! (either in a comment or a suggestion on the doc)



* Maud: Developers who are testing Attribution Reporting should consider adopting success and verbose debug reports. See the debug reports announcement and [guide](https://groups.google.com/u/0/a/chromium.org/g/attribution-reporting-api-dev/c/AkFEayKFrAg).
* Jon Guarino: Feedback: VAST Update Proposal for Chrome Privacy Sandbox Attribution Reporting API Support (Issue #[653](https://github.com/WICG/attribution-reporting-api/issues/653))
* Charlie: Per-reporting-site privacy budgeting (issue [661](https://github.com/WICG/attribution-reporting-api/issues/661))
* Charlie: Scheduled report time for event-level reports (PR [662](https://github.com/WICG/attribution-reporting-api/pull/662))
* David Dabbs: Why [Chrome plans on shipping the attribution reporting API](https://developer.chrome.com/docs/privacy-sandbox/attribution-reporting/chrome-shipping/). What is the scope of this?


# Attendees — please sign yourself in! 

(Please sign in at the start of the meeting)



1. Brian May (dstillery)
2. Charlie Harrison (Google Chrome)
3. David Dabbs (Epsilon)
4. Sid Sahoo (Google Chrome)
5. Matt Lamont (AdTheorent)
6. Akash Nadan (Google Chrome)
7. Joey Trotz (Google Privacy Sandbox)
8. Stacy Andrade (AdTheorent)
9. Nan Lin (Google Chrome)
10. Renan Feldman (Google Privacy Sandbox)
11. Michał Kalisz(RtbHouse)
12. Jon Guarino (Campaign Manager)
13. Aloïs Bissuel (Criteo)
14. Badih Ghazi (Google Research)


# Notes



1. David D: addition to today’s agenda. Discuss scope on why google plans to ship
2. Charlie: if we don’t have enough time, follow up offline
3. Topic 1: debugging
    1. Charlie: new developer guides have been released to show how to get additional insights. Make it easier to compare API results to your current results. Please provide feedback
4. Topic 2: VAST Update
    2. Jon G: VAST is a standard published by IAB for video ads. Advertisers provide VAST documents to the SDK. XML format. Info on what ads to show, what video formats, etc.
        1. More structured than display ads
        2. What should happen during video playback
        3. We want to be able to register clicks and impressions for video ads
        4. DSP side is not responsible for registering those click and impressions for videos. This is done by the SDKs
        5. Proposal is an update to the standard for impression and click registration
        6. VAST proposal outlines how this could work. Similar to attribution reporting
        7. There is a single ping and double ping registration proposals
        8. The proposal explains what SDKs would need to do for registrations
        9. Proposal has section about defining the XML parameters
        10. Open question on doc regarding single pings on click through
    3. Charlie: should work. We don’t require the dual click ping
        11. Recently needed to change our spec for navigation
        12. Any additional potential gaps?
    4. Jon G: very important we cover videos ads impressions and clicks. Very important to be able to track this
    5. Jon G: VAST distinguishes between click through and click tracker
    6. Charlie: potential gap for click tracker path. Can’t use both the foreground and background ping to register events. There may be a way to change VAST to work for 1 click tracker.
    7. Jon G: background ping can have redirects
    8. Charlie: A feature would need to be added to have other ways of doing this. We can document the gap explicitly with the current best possible solutions. Good feedback would be anything else blocking adoption for VAST
    9. Jon G: Origin trials may be an issue for adoption. General issue with iframe and permission policy. Might be worth documenting
    10. Charlie: need feedback on VAST regarding permission policy. Would be good to hear. A few adopters have shared what works for them regarding permission policy
    11. Brian M: question on if the issues regarding origin trials could be documented somewhere (potentially in an issue)
    12. Jon G: Not in the VAST document but can be added elsewhere. 
    13. Charlie: original trials have 3rd party registration
    14. Jon G: Similar process for SDKs
    15. Charlie: Potentially need to specify in the XML file what the VAST SDK needs to register
    16. Charlie: need to understand if SDK authors are willing to do this/this works. VAST tightly integrated with other features. If ARA ships a feature could have changes on VAST. If VAST wants to be part of the experimentation would be good to have this documented and planned
    17. Joey T: Have we considered sim ed? VAST isn’t updated very often. Better to get in front of IAB tech lab sooner. Would be ideal for landing impact and support
    18. Jon G: There are ways to bootstrap javascript code in VAST. May not have as good coverage. The most important measurement ping is the one from the video SDK. Seems like the right point to do registration similar to display. Plan to present to IAB tech lab. Good to have the draft ready and published. If generally accepted we can encourage adoption
    19. Joey T: tech lab is interested in demonstrating testing and compatibility. They could potentially do some tests themselves
    20. Brian M: Jon Could you update us once you hear back from the tech lab
    21. Charlie: We could just update via the github issue
    22. Charlie: VAST integrating with privacy sandbox. How much thought has been put into whether VAST needs to integrate with FLEDGE? 
    23. Jon G: Intention is to support video ads
    24. Charlie: Do we need any additional changes to the spec? Might require changes to the SDK code for integration with FLEDGE. There may be additional restrictions for reporting
    25. Jon G: video playback would be needed in the fenced frame
    26. Charlie: code might not be that different. Main differences are regarding communication on reporting between parties. This may need some research for VAST
    27. Brian M: in the last FLEDGE meeting, discussing duplicate impressions, which may have implications for companion ads
    28. Jon G: mainly focused on the display case. Plans to circle around to see how they are thinking about it
    29. Michał: have we considered if it is possible for video ads, to not only register source for ARA but also in the bidding function?
    30. Charlie: we have an issue in the fledge repo on how to pre register in the bidding function. Haven’t specified an exact API surface. Regardless, we might still need VAST changes to trigger them. VAST might need changes for standard regular reporting and ARA integrations in FLEDGE. Jon could some team on your side help to discuss this area a bit more
    31. Jon G: Charlie to double check the open questions on the doc
    32. Charlie: Jon could you document the gap regarding click trackers
5. Topic 3: Issue 661 per reporting site privacy budget
    33. Charlie: currently doing rate limits based on ad tech origin or reporting origin. If an ad tech cycles through a lot of origins you could potentially bypass some rate limits. We are considering tightening the privacy scope to be per reporting site. Two main limits impacted are destinations covered by unexpired sources and attributions per rate limit window. Not aware of any use cases that require an ad tech to split themselves to go over these limits. Makes the privacy budget more aligned with web sites. Hope this is relatively uncontroversial. Would like feedback on if this will hurt any use cases? Please post feedback on the github issue
    34. Alois B: Would this change be on both source and trigger?
    35. Charlie: for both source site and destination site, the reporting origin would be changed to the site, but we are not changing how attribution is scoped. We aren’t changing the source registration to be a site, we are just changing how/what we count for the two limits discussed above. Shouldn’t change anything regarding registration
    36. Brian M: sounds like a fairly benign change. 
    37. Charlie: if you are adopting this API you should be able to tell ahead of time if this change will cause impact
    38. Brian M: this may run into someone’s unique design
    39. Sid S: What about cross domains?
    40. Charlie: This shouldn’t cause impact. In the future we could consider moving to privacy budget by first party sets. If we move the internet from privacy at the site level to first party set this would tighten privacy further. This proposal is a step in that direction. This proposal won’t make any change on that kind of deployment
6. Topic 4: scheduled_report_time
    41. Charlie: heard feedback on event level API regarding the delay. Because the delay may be longer than expected because of user behavior etc. it became hard to debug the api. Aggregate reports already include scheduled_report_time of when the report is planned to be sent. We have added that same functionality to event level reports. Shows when chrome has scheduled when they had planned to send the report. Should be a strict utility improvement. 2 issues related to this that should be closed now
7. Topic 5: Intent 2 Ship feature set
    42. Charlie: before break we published a doc on why we are shipping this API. Questions regarding what is the feature set in the intent to ship?
    43. David D: Want to get a sense of what will be included?
    44. Charlie: We almost have a clear idea of what will be included. Could be ready in the next couple months as we prep for the I2S. For open issues that can’t make the cut, we may add a label for “future improvement”. What we want to do but might not make it to the first cut. As we get closer to the I2S date
    45. David: What is I2S? Intent 2 Ship
    46. Charlie: For chromium to ship we have to create an I2S with all the things we plan to ship. Plan to get the repo to a state that describes everything that will be included. We should be able to generate a backlog of what we want to implement in the future
8. David D: new feature posted regarding IPA, found that interesting. 
9. Charlie: APIs are very related. David Dabbs to add link to the note. IPA may be a lot simpler on the client.  \
Here is the new Chrome Feature entry for IPA added 29 Dec: [https://chromestatus.com/feature/4855434349903872](https://chromestatus.com/feature/4855434349903872).  \
See linked tracking bug for link to changeset in progress.   \

10. End of meeting
