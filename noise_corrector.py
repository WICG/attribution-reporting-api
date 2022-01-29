#!/usr/bin/env python3

import collections
import random

# This file provides a helper function to correct noisy data coming from the
# Attribution Reporting API.

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
  r = 1./len(observed_values)
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
    return (v - (1 - beta)*n*x*r) / (1 - (1 - beta)*x)
  return map(estimate, observed_values)

if __name__ == "__main__":
  # TODO(csharrison): Make the example robust to more parameter levels.
  # This example assumes 1 bit of metadata, 1 trigger per source, and 1
  # reporting window.
  true_reports = [
      50000, # Sources with no reports
      1000,  # Sources with conversion metadata "0"
      4000,  # Sources with conversion metadata "1"
  ]
  k = len(true_reports)

  # Simulate the API randomly flipping reports
  randomized_response_rate = .1
  noisy_reports = [0] * k
  for i,count in enumerate(true_reports):
    for r in range(count):
      if random.random() <= randomized_response_rate:
        new_bucket = random.randint(0, k - 1)
        noisy_reports[new_bucket] += 1
      else:
        noisy_reports[i] += 1

  corrected = estimate_true_values(noisy_reports, randomized_response_rate)

  column_names = ["Bucket", "True count", "Noisy count", "Corrected count"]
  print("{:<20}{:<20}{:<20}{:<20}".format(*column_names))
  for i, count in enumerate(corrected):
    print(f"{i:<20}{true_reports[i]:<20}{noisy_reports[i]:<20}{count:<20.2f}")
