# Attribution Reporting API

Mon Dec 11, 2023 @ 8am PT

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
* Scribe volunteer: Charlie Harrison

Please suggest agenda topics here! (either in a comment or a suggestion on the doc:



* Meetings over the holidays: Cancel the meeting on Christmas 🙂
* [Sid] Mode B debug reports
    * [https://developers.google.com/privacy-sandbox/setup/web/chrome-facilitated-testing#mode-b:~:text=To%20assist%20with%20debugging%20the%20Attribution%20Reporting%20API%20integration%20and%20to%20help%20testing%20participants%20better%20understand%20the%20noise%20impact%2C%20ARA%20debug%20reports%20will%20still%20be%20available%20for%20browsers%20in%20Mode%20B](https://developers.google.com/privacy-sandbox/setup/web/chrome-facilitated-testing#mode-b:~:text=To%20assist%20with%20debugging%20the%20Attribution%20Reporting%20API%20integration%20and%20to%20help%20testing%20participants%20better%20understand%20the%20noise%20impact%2C%20ARA%20debug%20reports%20will%20still%20be%20available%20for%20browsers%20in%20Mode%20B)
* [Hidayet] Summary report optimization in the Privacy Sandbox Attribution Reporting API
    * [https://blog.research.google/2023/12/summary-report-optimization-in-privacy.html](https://blog.research.google/2023/12/summary-report-optimization-in-privacy.html)
    * [https://arxiv.org/pdf/2311.13586.pdf](https://arxiv.org/pdf/2311.13586.pdf)
* [Ethan]: [https://openreview.net/forum?id=aG6xOP9QY7](https://openreview.net/forum?id=aG6xOP9QY7) a paper we submitted to Neurips on improvements to ML training with label differential privacy \



# Attendees — please sign yourself in! 

(Please sign in at the start of the meeting)



1. Charlie Harrison (Google Chrome)
2. Sid Sahoo (Google Chrome)
3. Hidayet Aksu (Google Privacy Sandbox)
4. Yuyan Lei (The Washington Post)
5. Ted Yankello (Adswerve)
6. Stacy Andrade (AdTheorent)
7. Michał Kalisz (RTB House)
8. Shirish Garg ( The New York Times)
9. Ethan Leeman (Google Privacy Sandbox)
10. Matt Lamont (AdTheorent)
11. Akash Nadan (Google Chrome)
12. Andrew Pascoe (NextRoll)
13. Ruchi Lohani (Google Privacy Sandbox)


# Notes

Mode B Debug reports



* [Sid] Mode B debug reports
    * Debug reports enable cleartext along with encrypted report for aggregatable reports. Only available with 3PCs, so they wouldn’t be available in the Mode B testing. But we are re-enabling them specifically for Mode B, since they are a useful functionality to test. Will link a page.
    * Private Aggregation API (though SS or protected audience) also has a similar feature, but those debug reports are not currently available in Mode B. If you have a need for that, please let us know (file an issue on Github).
* Michal
    * According to Private Agg API, it is only needed to set debug mode in one of the functions, but it requires 3PC enabled, right?
* Sid: Yes
* Michal: if you want to receive debug reports, we need to submit an issue
* Sid: Yes
* Michal: Can you clarify on the ARA. Do we need to set the CHIP cookie? Or won’t require anything on our side.
* Sid: Haven’t tested for myself. My understanding is we won’t need to do anything.
* Akash: +1
* Sid: [https://developers.google.com/privacy-sandbox/setup/web/chrome-facilitated-testing#mode-b](https://developers.google.com/privacy-sandbox/setup/web/chrome-facilitated-testing#mode-b)
* Michal: One more question. Some time ago, there was an issue (705) which described the way how verbose debug reports would work w/ aggregate reporting. Are there timelines? [https://github.com/WICG/attribution-reporting-api/issues/705](https://github.com/WICG/attribution-reporting-api/issues/705)
* Akash: we should have a timeline within the next couple of weeks, by early January. Still looking to gather feedback. ANy feedback please let us know.
* Michal: From our personal perspective, the verbose debugging helps a lot when you investigate when some reports are missing. From my POV it is worth to investigate.

[Hidayet] Summary report optimization in the Privacy Sandbox Attribution Reporting API



* Today going to talk about summary report optimization in ARA
* Last week to this day we published a blog post
* ARA summary reports
* Expore possible ways for advertiser to measure effectiveness of campaign
* Summary reports lets us query aggregate conversion logs
* Allows capturing impression features, and conversion features
* The problem: utility of the query depends on the configuration of the API
* How to configure the params is not straightforward
* To analyze, we model the API using four algorithms
    * ContributionVector, ContributionBounding, SummaryReport, ReconstructValues
    * First and last controlled by ad-tech
    * ContributionVector convers measurements into an array format that is discreteized and scaled
    * We propose a method that performs scaling and randomized rounding.
    * Output runs into ContributionBounding, which performs contribution bounding, drops contributions above a limit.
    * Summary report algorithm runs server side, it returns noisy results, sampled from discrete Laplace distribution. Reports can only be queried once.
    * ReconstructValues converts measurements back into original scale
* Error metrics
    * Serveral factors to consider for valuable metrics
    * We choose tao-truncated root mean square relative errr (RMSRE_T)
    * Similar to root mean squared error
    * Extra term makes it relative, and the truncated value
* Optimization
    * Can reduce this to an optimization (to optimzie RMSRE_T)
    * Choose a capping parameter C and privacy budget alpha for each slice
    * Can encode measurements on the ad tech side
    * RMSRE_T can be computed exactly, from the bias frm clipping and variance of noise.
    * For either C, alpha fixed, this is convex (easy), otherwise non-convex (harder), but still diable.
* Charlie: Capping param C, and alpha–how do they map to the API concepts?
* Hidayet: Contribution Bounding fixed, already dropped when contribution coming form the same impression exceeds bound. Need to encode in the best way that we will pass the most signals that can pass through this. Ad tech has a choice. Actual value can be $21, or $5. A simple thing would be to just use the “actual value”, scaled to the range the API will support (2^16). This will be quite inefficient due to the spread of the values. In Algorithm A, we can cap each value we are encoding. From the TEE we are measurement multiple things (#items and value). We need to share budget across count and value. Two decisions
    * How to share budget between count and value
    * How to encode these values. This one will require capping. How to cap?
* Synthetic data
    * To evaluate different API configs, we need to experiment on a dataset.
    * We addressed this using synthetic data. We did empirical analysis on real conversion data set, and uncovered characteristics relevant to ARA
    * Found our approach closely matched characteristics from real datasets
    * Once we construct this pipeline, we also use this data in the evaluations
* Experimental Evaluations
    * Criteo sponsored search, Real estate, travel. 3 synthetic ones
    * Dataset partitioning, into training and test. Train → choose budgets thresholds and limits
    * Error evaluated using RMSRE_T. T being 5 times the median value of the training data
    * Compare based on baseline using equal contribution budget (e.g. across counts / values) and uses a fixed quantile for clipping
    * Our algorithms produce lower error than baseline in all cases (real and synthetic)
* Conclusion
    * Our approach uses historical data to bound and scale contributions under differential privacy
    * We use past data to derive the distribution then apply statistics
    * Blog post, paper, and code are public. Including synthetic data generation and whole algorithms

[Ethan Leeman]: [https://openreview.net/forum?id=aG6xOP9QY7](https://openreview.net/forum?id=aG6xOP9QY7) a paper we submitted to Neurips on improvements to ML training with label differential privacy



* Optimal unbiased randomizers for regression with label differential privacy
* This is more forward looking, we can bring it down to earth to ARA at any time
* Differential privacy background
    * Powerful notion of keeping user’s data private. We have a mathematical framework. Two databases that differ on a neighboring relationship, probability that the mechanism will output a particular output is bounded across neighbors by a multiplicative constant (e^eps).
    * Bunch of examples for model training. DP-SGD, PATE, DP-FTRL.
* Label differential privacy. Weaker notion of privacy. Before, if you changed the feature OR label of a user, we need to protect it. Now the only thing that is private is the user’s label.
    * Whether the user _converted_ will be private
* Other interesting research in the spectrum between full DP and label DP. Subset of features that are private.
* History: first studied in the context of classification, now we are concerned regression tasks
* Baseline method: randomized response
    * If you have a label DOG, epsilon RR over a class of possible labels (cat, dog, horse, fish). Dog will be higher probability, all other equal probability
    * In other work, we say that you can use a _prior_ to derive a better mechanism. We maximize the 0/1 loss (subject to DP), you can come up with a better mechanism that solves this optimization problem.
    * To set the stage, you
        * Come up with a prior
        * Set up an optimization problem
        * Solve the optimization problem subject to DP
* Mechanisms using prior
    * Regression vs. classification
    * Basically we change the loss metric (0/1 loss to MSE or PLL). Same kind of setup. Get a prior distribution, optimization function (minimize the noisy label loss, subject to DP)
    * This is just a linear program, we have algorithms to solve this
    * If you impose extra constraints on the linear program (“unbiased condition”). The labels will be suboptimal in absolute terms, they will train better
    * Unbiased: the noisy label must be the true label in expectation
    * Get a separate distribution depending on the input, s.t. The average will equal the input label
* Motivation for unbiased noisy labels
    * This is doing a bias variance trade-off. Previously we minimized variance. Now we minimize variance subject to bias = 0 (bias minimizing).
    * 0 bias preserves the Bayes optimal predictor
    * Predictor mimnimizing loss wrt noisy labels = predictor minimizing loss wrt true labels
        * Only true if the mechanism is unbiased
    * If you have 0 biased, provided unbiased stochastic gradients. True if you loss function is affine in the label
    * If you have unbiased stochastic gradients, asymptomatic approach the bayes optimal predictor
* Final Mechanism: using privately estimated prior
    * Privately query using a small epsilon to get the prior
    * Then you can use that to compute the LP (linear program)
    * Apply the randomized M with the rest of the budget
* Evaluation on Criteo Conversion Log dataset (sponsored search)
    * Predict conversion value (clip to 400 euros)
    * On the left: purple and brown. RROnBins (purple) minimized variance. This is the smallest for MSE. Brown is actually high (does not minimze variance)
    * On the right (prediction loss) brown is the lowest. This is state of the art compared ot the baseline as well as randomized response
* Evaluation on App Ads conversion count
    * Count problem
    * Goal is to predict the # of post-click conversion events in an app after the user installed w/in a time frame.
    * Instead of MSE we compute the relative poisson log loss. This is minimized by the brown mechanism (unbiased mech)
* Highlights
    * Unbiased randomizers eliminate bias at the cost of increased variance
    * Optimal unbiased randomizers provide most utility in practice compared to baseline
    * Partial characterization of optimal unbiased randomizers (staircase mechanisms)
    * Bound on the number of output labels
    * Future directions:
        * Full characterization of the optimal unbiased randomizers
        * Better algorithms for computing optimal unbiased randomizers (instead of solving the linear program). However even a coarse discreteization did better
* Charlie: how does this apply to ARA?
* Ethan: you could imagine in the future some extensions of the evnet-level API to give you labels subject to this. If you just get the noisy labels and your end goal is to train a bidding model, in the end you might want specifically labels that satisfy this unbiased condition. That might optimize for model performance.
    * We are future looking into future changes to the ARA that will include noisy labels subject to this unbiased conditions
* Sid: You talk about the prior distribution. This would be particular to that ad techs implementation. That requires some operationalization? This technique could be applied to the technique. But the prior is custom. How to bridge that gap?
* Ethan: very good point, it could go in a bunch of different directions. INitial thought is the ad tech could do this themselves. The unoptimized API can give them this prior, then in the future they can do this.
    * Alternatively this could be end to end, where we do the optimal privacy budget split.
* Sid: could you take advantage of the aggregate reporting surface?
* Ethan: these histograms are a bit different from summary reports, so not directly applicable that you will be able to compute the private prior, but in theory yes you could do it. If this takes off we could consider changes to the agg service
* Charlie: Expand on using the unoptimized API to figure out the prior. How difficult is it to query based on the unoptimized prior vs a steady-state situation?
* Ethan: haven’t tackled online capturing of how the prior changes. Good future direction. I was more saying you could do this by giving a baseline spec to the event API, capturing a prior. That would be suboptimal. BUt you could do it, if you didn’t have access to the agg reporting way.
    * We have noticed that even pretty far-off values for prior give similar values for the final mechanism. As long as you have a half-decent estimation, probably in good shape.
