#!/usr/bin/env python3

import collections
import json
import math
import numpy
import random

# This file provides a helper function `estimate_true_values` to correct noisy data coming from the
# event-level reports in the Attribution Reporting API. It also includes
# utilities for enumerating the possible outputs from various parametrizations
# of the event-level reports. See
# - get_possible_nav_source_outputs
# - get_possible_event_source_outputs
# - generate_possible_outputs_per_source

# Estimates the true values for data generated through k-ary randomized
# response. It includes a parameter `beta` which allows smoothly trading off
# bias (minimized with `beta` = 0) and variance (minimized when `beta` = 1).
def estimate_true_values(observed_values, randomized_response_rate, beta=0):
  """Returns a list of corrected counts

  observed_values: A list of size `k` for k-ary randomized response, where the
    ith value in the list indicates the counts of the ith output (out of k).
  randomized_response_rate: The probability any given output is randomized
  """
  n = sum(observed_values)
  r = 1. / len(observed_values)
  x = randomized_response_rate

  # An observed value v will be distributed according to
  # BinomialDistribution[n, q] where
  # q = (1 - x)*(v' / n) + xr
  # Where v' is the true value.
  #
  # E[v_hat] = E[(v - (1 - b)nxr) / (1 - (1 - b)x)]
  # = (v'(1 - x) + nxr - (1 - b)nxr) / (1 - (1 - b)x)
  # = (v'(1 - x) + bnxr) / (1 - (1 - b)x)
  #
  # For b = 0 --> E[v_hat] = v' i.e. the estimator is unbiased.
  # For b = 1 --> E[v_hat] = v'(1-x) + bnxr
  #
  # V[v_hat] = V[(v - (1 - b)nxr) / (1 - (1 - b)x)]
  # = V[v] / (1 - (1 - b)x)^2
  # = nq(1-q) / (1 - (1 - b)x)^2
  #
  # For b = 0 --> V[v_hat] = nq(1-q) / (1 - x)^2
  # For b = 1 --> V[v_hat] = nq(1-q)
  def estimate(v):
    return (v - (1 - beta) * n * x * r) / (1 - (1 - beta) * x)

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
    """Returns a report description"""

    bars_prior_to_star = star_index - (max_reports - 1 - num_star)

    # Any stars before any bars means the report is suppressed.
    if bars_prior_to_star == 0:
      return "No report"

    # Otherwise, the number of bars just indexes into the cartesian product
    # of |data_cardinality| x |num_windows|.
    # Subtract the first bar because that just begins the first window.
    window, data = divmod(bars_prior_to_star - 1, data_cardinality)
    return {"window": window, "data": data}

  def generate_output(N):
    star_indices = find_k_comb(N, max_reports)
    return [bars_to_report(s, i) for i, s in enumerate(star_indices)]

  star_bar_length = data_cardinality * max_windows + max_reports
  num_sequences = math.comb(star_bar_length, max_reports)
  return [generate_output(i) for i in range(num_sequences)]


def get_possible_event_source_outputs():
  """Returns the possible outputs for an event source"""
  return generate_possible_outputs_per_source(1, 2, 1)


def get_possible_nav_source_outputs():
  """Returns all the possible outputs for navigation source"""
  return generate_possible_outputs_per_source(3, 8, 3)


# Params are taken from the EVENT.md explainer:
# https://github.com/WICG/conversion-measurement-api/blob/main/EVENT.md#data-limits-and-noise
def correct_event_sources(observed_values):
  # No triggers, 1 trigger with metadata 0, 1 trigger with metadata 1.
  assert len(observed_values) == 3
  randomized_response_rate = .0000025
  return estimate_true_values(observed_values, randomized_response_rate)


def correct_nav_sources(observed_values):
  assert len(observed_values) == 2925
  randomized_response_rate = .0024
  return estimate_true_values(observed_values, randomized_response_rate)


def simulate_randomization(true_reports, randomized_response_rate):
  """Simulates randomized response on true_reports"""
  n = sum(true_reports)
  k = len(true_reports)
  noisy_reports = [0] * k

  # This method could be implemented by doing randomized response on every
  # indivual true report. However, we can optimize this by noticing that
  # Every bucket's final result will be distributed according to a Binomial
  # distribution with parameter n and q = (1 - x)*(v' / n) + xr
  # Where x = randomized_response_rate. Note that this is just an estimate,
  # since the true randomized response will not be independent for each value.
  x = randomized_response_rate

  def gen_noisy(true_count):
    q = (1 - x) * (true_count / n) + x / k
    return numpy.random.binomial(n, q)
  return [gen_noisy(c) for c in true_reports]


if __name__ == "__main__":
  # This example runs sample data through a simulation of the randomized
  # response, and applies the noise correction to it.
  true_reports = [
      100_000_000,  # Sources with no reports
      100_000,  # Sources with conversion metadata "0"
      40_000,  # Sources with conversion metadata "1"
  ]
  randomized_response_rate = .0000025

  noisy_reports = simulate_randomization(true_reports, randomized_response_rate)
  corrected = correct_event_sources(noisy_reports)
  outputs = get_possible_event_source_outputs()
  column_names = ["Output", "True count", "Noisy count", "Corrected count"]
  print("{:<30}{:<20}{:<20}{:<20}".format(*column_names))
  for i, v in enumerate(corrected):
    d = json.dumps(outputs[i])
    print(f"{d:<30}{true_reports[i]:<20,}{noisy_reports[i]:<20,}{v:<20,.1f}")
