#!/usr/bin/env python3

import collections
import json
import math
import numpy
import random

# This file provides functionality to correct noisy data coming from the event-level reports in the Attribution Reporting API. The output is an estimate of what the real report distribution looks like.
# Call `correct_nav_sources` and `correct_event_sources` to correct noisy reports⏤respectively click reports and view reports.
# Under the hood, both these functions use `estimate_true_values`; this function applies mathematical operations to correct noisy data coming from the event-level reports. 
# This file also includes additional utilities for enumerating the possible outputs from various parametrizations
# of the event-level reports.
# - `get_possible_nav_source_outputs`
# - `get_possible_event_source_outputs`
# - `generate_possible_outputs_per_source`


# Noise rate values are taken from the EVENT.md explainer:
# https://github.com/WICG/conversion-measurement-api/blob/main/EVENT.md#data-limits-and-noise

RANDOMIZED_RESPONSE_RATE_EVENT_SOURCES = .0000025
RANDOMIZED_RESPONSE_RATE_NAV_SOURCES = .0024

def run_example():
  ################ EXAMPLE ################
  # This example runs sample data through a simulation of the randomized
  # response, and applies the noise correction to it.

  # Optional (added here to help understanding of this example): get all the possible outputs
  outputs = get_possible_event_source_outputs()
  true_reports = [
      100_000_000,  # Sources with no reports
      100_000,  # Sources with trigger (conversion) data "0"
      40_000,  # Sources with trigger (conversion) data "1"
  ]
  # Simulate what the noisy reports produced by the browser would look like
  noisy_reports = simulate_randomization(
      true_reports, RANDOMIZED_RESPONSE_RATE_EVENT_SOURCES)
  # Generate the noise-corrected reports 
  # To use this script in a real system, replace `noisy_reports` with the actual attribution reports received by the endpoint (and sent from users' browsers).
  # Note how `noisy_reports` is NOT a list of reports; it's an array of counts of reports of each kind
  # For example, for view reports: `noisy_reports = [42, 10, 13]` would mean that among the 147 views that you recorded: 42 of them resulted in no report, 10 of them resulted in a report with trigger data 0, and 13 of them in a report with trigger data 1
  corrected_reports = correct_event_sources(noisy_reports)

  # Print the result in a tabular form
  column_names = ["Output", "True count", "Noisy count", "Corrected count"]
  print("{:<30}{:<20}{:<20}{:<20}".format(*column_names))
  for i, v in enumerate(corrected_reports):
    d = json.dumps(outputs[i])
    print(f"{d:<30}{true_reports[i]:<20,}{noisy_reports[i]:<20,}{v:<20,.1f}")


# Estimates the true values for data generated through k-ary randomized
# response. The estimator should be unbiased.
def estimate_true_values(observed_values, randomized_response_rate, beta=0):
  """Returns a list of corrected counts

  observed_values: A list of size `k` for k-ary randomized response, where the
    ith value in the list indicates the counts of the ith output (out of k).
  randomized_response_rate: The probability any given output is randomized
  """
  n = sum(observed_values)
  k = len(observed_values)
  x = randomized_response_rate

  # Proof: see formula 6 in https://arxiv.org/pdf/1602.07387.pdf. Note in that
  # formulation, `x` = (k / (k + exp(epsilon) - 1)).
  # Performing that substitution yields:
  # estimate(v) = (v(k + exp(eps) - 1) - n) / (exp(eps) - 1)
  # Which matches formula 6 after applying a multiplication of `n` to transform
  # rates to counts.
  def estimate(v):
    return (v -  n * x / k) / (1 - x)

  return [estimate(v) for v in observed_values]


def generate_possible_outputs_per_source(max_reports, data_cardinality,
                                         max_windows):
  """Enumerates all possible outputs for any given source event

  max_reports: The maximum number of triggers that can be attributed to this
                source.
  data_cardinality: The number of possible trigger_data values for the source.
  max_windows: The number of reporting windows any given report can show up in.

  Returns: a JSON list of all possible outputs. Each output is a list of size
           `max_reports`, describing each report (its trigger_data and window).
  """

  # TODO(csharrison): Consider just enumerating the reports directly vs.
  # enumerating the k-combinations.
  def find_k_comb(N, k):
    """Computes the Nth lexicographically smallest k-combination

    https://en.wikipedia.org/wiki/Combinatorial_number_system

    Follows the greedy algorithm outlined here:
    http://math0.wvstateu.edu/~baker/cs405/code/Combinadics.html
    """
    target = N
    c = 0
    while math.comb(c, k) <= N:
      c += 1

    combos = []
    while c >= 0 and k >= 0:
      coef = math.comb(c, k)
      if coef <= target:
        combos.append(c)
        k -= 1
        target -= coef
      c -= 1
    return combos

  def bars_to_report(star_index, num_star):
    """Returns a report description of the form:
    {
      "window": <window index>,
      "trigger_data": <trigger data>
    }
    """

    bars_prior_to_star = star_index - (max_reports - 1 - num_star)

    # Any stars before any bars means the report is suppressed.
    if bars_prior_to_star == 0:
      return "No report"

    # Otherwise, the number of bars just indexes into the cartesian product
    # of |data_cardinality| x |num_windows|.
    # Subtract the first bar because that just begins the first window.
    window, data = divmod(bars_prior_to_star - 1, data_cardinality)
    return {"window": window, "trigger_data": data}

  def generate_output(N):
    star_indices = find_k_comb(N, max_reports)
    return [bars_to_report(s, i) for i, s in enumerate(star_indices)]

  star_bar_length = data_cardinality * max_windows + max_reports
  num_sequences = math.comb(star_bar_length, max_reports)
  return [generate_output(i) for i in range(num_sequences)]


def get_possible_event_source_outputs():
  """Returns the possible outputs for an event source"""
  # event_sources are when a user views an ad
  max_reports_event_sources = 1
  # view source events id can be up to one bit i.e. their value is one the 2 values
  data_cardinality_event_sources = 2
  # for views, there's only one reporting window
  max_windows_event_sources = 1
  return generate_possible_outputs_per_source(max_reports_event_sources,
                                              data_cardinality_event_sources,
                                              max_windows_event_sources)


def get_possible_nav_source_outputs():
  """Returns all the possible outputs for navigation source"""
  # nav_sources are when a user clicks on an ad.
  max_reports_nav_sources = 3
  # Navigation source id can be up to 3 bits i.e. their value is one of 8
  # values.
  data_cardinality_nav_sources = 8
  # for clicks, there are 3 reporting windows.
  max_windows_nav_sources = 3
  return generate_possible_outputs_per_source(max_reports_nav_sources,
                                              data_cardinality_nav_sources,
                                              max_windows_nav_sources)


# Params are taken from the EVENT.md explainer:
# https://github.com/WICG/conversion-measurement-api/blob/main/EVENT.md#data-limits-and-noise
def correct_event_sources(observed_values):
  # For event sources, there should be 3 possible observed values:
  # No triggers, 1 trigger with trigger (conversion) data 0, 1 trigger with trigger (conversion) data 1.
  assert len(observed_values) == 3
  return estimate_true_values(observed_values,
                              RANDOMIZED_RESPONSE_RATE_EVENT_SOURCES)


def correct_nav_sources(observed_values):
  # For navigation sources, there should be 2925 possible observed values. The
  # reasion for this is fairly complicated. The output for a given source has a
  # one-to-one mapping with a "stars and bars" sequence of `max_reports` stars
  # and `max_windows * data_cardinality` bars. Thus the number of possible
  # outputs is given by (num_stars + num_bars choose num_bars) = (27 choose 3) =
  # 2925.
  # https://en.wikipedia.org/wiki/Stars_and_bars_(combinatorics)
  assert len(observed_values) == 2925
  return estimate_true_values(observed_values,
                              RANDOMIZED_RESPONSE_RATE_NAV_SOURCES)


def simulate_randomization(true_reports, randomized_response_rate):
  """Simulates randomized response on true_reports; this simulates the way the
  browser would treat reports in an idealized system (e.g. no rate limits hit,
  etc)."""
  n = sum(true_reports)
  k = len(true_reports)
  noisy_reports = [0] * k

  # This method could be implemented by doing randomized response on every
  # individual true report. However, we can optimize this by directly computing
  # the number of total responses that would have flipped, and uniformly
  # distributing them across all k buckets.
  x = randomized_response_rate

  # Compute the non-flipped counts.
  non_flipped_counts = [numpy.random.binomial(true_count, 1 - x) for true_count in true_reports]

  # Distribute the flipped reports uniformly among all k buckets.
  num_flipped = n - sum(non_flipped_counts)
  flipped_counts = numpy.random.multinomial(num_flipped, [1/k] * k)
  return non_flipped_counts + flipped_counts

if __name__ == "__main__":
  run_example()
