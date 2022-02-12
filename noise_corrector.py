#!/usr/bin/env python3

import argparse
import collections
from datetime import timedelta
import itertools
import json
import numpy
import random
from typing import List, Hashable

# This file provides functionality to correct noisy data coming from the event-level reports in the Attribution Reporting API.


# Noise rate values are taken from the EVENT.md explainer:
# https://github.com/WICG/conversion-measurement-api/blob/main/EVENT.md#data-limits-and-noise

################## GENERIC UTILITIES ##################

class ParamConfig:
  def __init__(self,
               randomized_reponse_rate,
               trigger_data_cardinality,
               max_reports,
               max_windows,
               name):
    self.rr_rate = randomized_reponse_rate
    self.data_cardinality = trigger_data_cardinality
    self.max_reports = max_reports
    self.max_windows = max_windows
    self.name = name


NAV_PARAMS = ParamConfig(.5, 8, 3, 3, "navigation")
EVENT_PARAMS = ParamConfig(.0000025, 2, 1, 1, "event")


class OutputEnumeration:
  # Class encapsulating logic which represents the logical output of the API
  # per source event, for the purposes of debiasing the randomized response
  # privacy mechanism.
  def __init__(self, report_tuple, params: ParamConfig):
    """report_tuple must be in the form ((window_index, trigger_data),...)"""
    self.output = tuple(sorted(report_tuple))
    self.params = params

  def __str__(self):
    def report_to_string(r):
      if r is None:
        return "No report"
      return {"window": r[0], "data": r[1]}
    return json.dumps([report_to_string(r) for r in self.output])

  def __repr__(self): return self.output.__repr__()
  def __hash__(self): return self.output.__hash__()

  # Needed to support instances in dictionaries
  def __eq__(self, other): return self.output.__eq__(other.output)
  def __lt__(self, other): return self.output.__lt__(other.output)

  @classmethod
  def create_null(cls, params: ParamConfig):
    return cls((), params)

  @classmethod
  def create_from_data(cls, source_with_reports):
    """Create an output directly from structured data

    source_with_reports: list of (source, [report, ...]) tuples.
    See get_conversion_counts for expected structure for sources and reports.
    """
    source, reports = source_with_reports
    params = EVENT_PARAMS if source["source_type"] == "event" else NAV_PARAMS
    max_reports = params.max_reports
    assert len(reports) <= max_reports
    return cls(tuple(OutputEnumeration._parse_report(source, r) for r in reports),
               params)

  @classmethod
  def generate_all(cls, params: ParamConfig):
    all_single_reports = list(itertools.product(range(params.max_windows),
                                                range(params.data_cardinality)))
    all_reports_ordered = []
    for r in range(params.max_reports + 1):
      reports = itertools.product(*(r * [all_single_reports]))
      all_reports_ordered.extend(list(reports))
    # Simulate shuffling within a reporting window by sorting and deduping
    deduped = set([tuple(sorted(x)) for x in all_reports_ordered])
    return sorted([cls(x, params) for x in deduped])

  def data_histogram(self):
    """Returns the number of reports associated with this output, broken
    out by the trigger_data"""

    histogram = numpy.zeros(self.params.data_cardinality)
    for r in self.output:
      histogram[r[1]] += 1
    return histogram

  def get_report_time(self, window: int, source: dict):
    expiry = source["registration_config"]["expiry"]
    if self.params.name == "event":
      return expiry

    # TODO(csharrison): This assumes the expiry > 7 days.
    windows = [timedelta(days=2), timedelta(days=7), timedelta(seconds=expiry)]
    source_time = source["source_time"]
    return int(source_time + windows[window].total_seconds())

  def generate_reports_for_source(self, source: dict):
    assert self.params.name == source["source_type"]
    source_event_id = source["registration_config"]["source_event_id"]

    reports = []
    for window, trigger_data in self.output:
      reports.append({
          "report_time": self.get_report_time(window, source),
          "report": {
              "source_event_id": source_event_id,
              "source_type": self.params.name,
              "trigger_data": str(trigger_data)
          }
      })
      return reports

  @staticmethod
  def _parse_report(source, report: dict):
    window_index = OutputEnumeration._get_window_index_for_report(
        source, report)
    trigger_data = int(report["report"]["trigger_data"])
    return (window_index, trigger_data)

  @staticmethod
  def _get_window_index_for_report(source: dict, report: dict):
    if source["source_type"] == "event":
      return 0

    report_time = report["report_time"]
    source_time = source["source_time"]
    raw_expiry = source["registration_config"]["expiry"]
    expiry = timedelta(seconds=int(raw_expiry))
    delta = timedelta(seconds=report_time - source_time)

    # Navigation sources have 3 possible reporting windows.
    # TODO(csharrison): this assumes that the expiry > 7 days. This should be
    # updated to be more robust.
    assert expiry > timedelta(days=7)
    if delta >= expiry:
      return 2
    if delta >= timedelta(days=7):
      return 1
    return 0


# Estimates the true values for data generated through k-ary randomized
# response. The estimator should be unbiased.
def estimate_true_values(observed_values: dict, randomized_response_rate: float):
  """Returns a list of corrected counts

  observed_values: A map of size `k` for k-ary randomized response. Each item
                   represents a randomized response output as the key, with its
                   associated count as the value.

  randomized_response_rate: The probability any given output is randomized
  """
  n = sum(observed_values.values())
  k = len(observed_values)
  x = randomized_response_rate

  # Proof: see formula 6 in https://arxiv.org/pdf/1602.07387.pdf. Note in that
  # formulation, `x` = (k / (k + exp(epsilon) - 1)).
  # Performing that substitution yields:
  # estimate(v) = (v(k + exp(eps) - 1) - n) / (exp(eps) - 1)
  # Which matches formula 6 after applying a multiplication of `n` to transform
  # rates to counts.
  def estimate(v):
    return (v - n * x / k) / (1 - x)

  return {k: estimate(v) for k, v in observed_values.items()}


def join_reports_with_sources(sources: dict, reports: dict):
  """Returns tuple of (source, [reports]) joined with the source_event_id"""
  report_map = collections.defaultdict(list)
  for r in reports["reports"]:
    report_map[r["report"]["source_event_id"]].append(r)

  def join(source):
    source_event_id = source['registration_config']['source_event_id']
    return (source, report_map[source_event_id])
  return [join(s) for s in sources['sources']]

################## AGGREGATE UTILITIES ##################


def print_data_histogram(hist: List[float], type: str):
  print(f"Histogram of trigger_data for {type} sources:")
  print("{:<20}{:<15}".format("trigger_data", "count"))
  for i, count in enumerate(hist):
    print(f"{i:<20}{count:.2f}")
  print()


def get_raw_corrected_map(joined: dict, params: ParamConfig):
  output_counts = {o: 0 for o in OutputEnumeration.generate_all(params)}
  for j in joined:
    output = OutputEnumeration.create_from_data(j)
    assert output in output_counts
    output_counts[output] += 1

  return estimate_true_values(output_counts, params.rr_rate)


def correct_aggregates(joined: dict, params: ParamConfig):
  corrected = get_raw_corrected_map(joined, params)
  histogram = numpy.zeros(params.data_cardinality)
  for o, c in corrected.items():
    histogram += c * o.data_histogram()
  return histogram


################## EVENT-LEVEL UTILITIES ##################

def adjust_to_match_distribution(values: Hashable, distribution: dict, default_value):
  """Given a list of values, and an aggregate map that weights all possible values,
  returns a list of adjusted values to match the distribution.

  values: list of arbitrary objects (must be possible to place in dict/set). To
          minimize bias, this list should be shuffled prior to calling this
          method.
  distribution: map of value -> estimated count. All values in `values` must be
                present. Note that negatives are allowed, but it will mean the
                output of the function will be biased.
  default_value: a default / null value

  The algorithm used in this method attempts to achieve two goals:
  1. The output values match the distribution as much as possible, minimizing
     bias.
  2. The output maximizes "overlap" with the input. That is, satisfying (1), we
     want to minimize the number of inputs that are adjusted.
  """

  # Split the distribution into two chunks: elements with mass >= 1 and not.
  # Clamp negatives to 0. Note this introduces bias, but it seems unavoidable.
  large_elts = {k: v for k, v in distribution.items() if v >= 1}
  small_elts = {k: max(0, v) for k, v in distribution.items() if v < 1}
  assert len(small_elts) + len(large_elts) == len(distribution)

  def decrement_large_elt(elt):
    large_elts[elt] -= 1
    if large_elts[elt] < 1:
      small_elts[elt] = large_elts[elt]
      large_elts.pop(elt)

  def handle_value(val):
    assert val in distribution and (val in small_elts or val in large_elts)
    # Do not adjust s if there is mass in the aggregate distribution for it.
    if val in large_elts:
      decrement_large_elt(val)
      return val

    # Otherwise, pick from among the elements with enough mass for subtraction.
    if len(large_elts) > 0:
      elt = random.choices(list(large_elts.keys()), large_elts.values())[0]
      decrement_large_elt(elt)
      return elt

    # Otherwise, sample with replacement from the small elts, with any leftover
    # mass defaulting to a default value / null value. This also introduces
    # small bias towards the null value bucket.
    total_mass_remaining = sum(small_elts.values())
    if random.random() <= total_mass_remaining:
      return random.choices(list(small_elts.keys()), small_elts.values())[0]
    return default_value

  return [handle_value(v) for v in values]


def generate_corrected_event_level(joined: dict, params: ParamConfig):
  # Shuffle the input data. This is because the order of which values are
  # considered in the loop below matters, because we adjust the distribution
  # as we go. Shuffling first avoids favoring some values over others.
  # Note: ideally adjust_to_match_distribution would shuffle, but it becomes
  # more difficult to associate the adjustments with the input JSON.
  random.shuffle(joined)
  aggregates = get_raw_corrected_map(joined, params)
  outputs = [OutputEnumeration.create_from_data(j) for j in joined]
  adjusted_values = adjust_to_match_distribution(
      outputs, aggregates, OutputEnumeration.create_null(params))

  def adjust_json(j, unadjusted, adjusted):
    source = j[0]
    source_event_id = source['registration_config']['source_event_id']
    adjusted_reports = adjusted.generate_reports_for_source(source)
    return (source, adjusted_reports)

  return [adjust_json(j, o, a) for j, o, a in zip(joined, outputs, adjusted_values)]


def main():
  DESCRIPTION = """\
  noise_corrector.py is a command-line tool that attempts to debias the noise
  output in the Attribution Reporting API for event-level reports. It takes as
  input JSON files which represent source registrations and the resulting
  event-level reports. It can provide corrected output in aggregate, or via
  generating synthetic event-level data.

  The noise added in the API is described at:
  https://github.com/WICG/conversion-measurement-api/blob/main/EVENT.md#data-limits-and-noise
  """
  parser = argparse.ArgumentParser(
      description=DESCRIPTION, formatter_class=argparse.RawTextHelpFormatter)
  SOURCE_HELP = """\
  Required path to an input file containing sources, in the following JSON
  format:
  {
    // List of zero or more sources.
    "sources": [
      {
        // Required time at which to register the source in seconds since the
        // UNIX epoch.
        "source_time": 123,

        // Required source type, either "navigation" or "event", corresponding to
        // whether the source is registered on click or on view, respectively.
        "source_type": "navigation",

        "registration_config": {
          // Required uint64 formatted as a base-10 string.
          "source_event_id": "123456789",

          // Optional int64 in milliseconds formatted as a base-10 string.
          // Defaults to 30 days.
          "expiry": "864000000",
        }
      },
      ...
    ]
  }
    """
  parser.add_argument('--source_file', dest='source_file',
                      type=open, help=SOURCE_HELP, required=True)
  REPORT_HELP = """\
  Required path to an input file containing reports, in the following JSON
  format:
  {
    // List of zero or more reports.
    reports: [
      {
        // Time at which the report would have been sent in seconds since the
        // UNIX epoch.
        "report_time": 123,

        // The report itself.
        "report": {
          "source_event_id": "1337",
          "source_type": "navigation",

          // Coarse data set in the attribution trigger registration
          "trigger_data": "4"
        }
      },
      ...
    ]
  }
    """
  parser.add_argument('--report_file', dest='report_file',
                      type=open, help=REPORT_HELP, required=True)

  OUTPUT_MODE_HELP = """\
  Optional. One of `event-level` or `aggregate`. Defaults to `aggregate`, which
  provides aggregate counts for different trigger metadata values. The
  `event-level` mode outputs synthetic sources and their associated reports
  matching the debiased aggregate data as best as possible.
  """
  parser.add_argument('--output_mode', dest='output_mode',
                      choices=['event-level', 'aggregate'],
                      default='aggregate', help=OUTPUT_MODE_HELP)

  args = parser.parse_args()

  source_json = json.load(args.source_file)
  report_json = json.load(args.report_file)
  joined = join_reports_with_sources(source_json, report_json)
  navs = [s for s in joined if s[0]["source_type"] == "navigation"]
  events = [s for s in joined if s[0]["source_type"] == "event"]
  if args.output_mode == 'aggregate':
    nav_histogram = correct_aggregates(navs, NAV_PARAMS)
    event_histogram = correct_aggregates(events, EVENT_PARAMS)
    print_data_histogram(nav_histogram, "navigation")
    print_data_histogram(event_histogram, "event")

  elif args.output_mode == 'event-level':
    nav_corrected = generate_corrected_event_level(navs, NAV_PARAMS)
    print(json.dumps(nav_corrected))


if __name__ == "__main__":
  main()
