#!/usr/bin/env python3

import argparse
import collections
from datetime import timedelta
import json
import numpy
import random
from typing import Any, List, Hashable, Tuple, Dict, TypedDict, TypeVar, Generator, Iterable
import sys

# This file provides functionality to correct noisy data coming from the event-level reports in the Attribution Reporting API.
#
# Noise rate values are taken from the EVENT.md explainer:
# https://github.com/WICG/conversion-measurement-api/blob/main/EVENT.md#data-limits-and-noise

VERSION = "noise_corrector.py 0.0.1"

################## GENERIC UTILITIES ##################

# Useful type declarations for working with JSON:
class SourceRegistrationConfig(TypedDict, total=False):
  source_event_id: str
  expiry: int # Optional


class Source(TypedDict):
  source_time: int
  source_type: str
  registration_config: SourceRegistrationConfig


class ReportRaw(TypedDict):
  source_event_id: str
  source_type: str
  trigger_data: str


class Report(TypedDict):
  report_time: int
  report: ReportRaw


Joined = Tuple[Source, List[Report]]
JoinedList = List[Joined]
JoinedGen  = Generator[Joined, None, None]
# Raw output configurations for correcting randomized response.
# The first int is window_index (i.e. which reporting window the output fell in).
# The second int is trigger_data.
OutputConfig = Tuple[Tuple[int, int], ...]

# For generic functions.
T = TypeVar('T')

OutputEnumerationGen = Generator['OutputEnumeration', None, None]

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


# https://github.com/WICG/conversion-measurement-api/blob/main/EVENT.md#data-limits-and-noise
NAV_PARAMS = ParamConfig(.0024, 8, 3, 3, 'navigation')
EVENT_PARAMS = ParamConfig(.0000025, 2, 1, 1, 'event')

# See 9.8.11
# https://wicg.github.io/conversion-measurement-api/#obtaining-attribution-source-params
DEFAULT_EXPIRY = 60 * 60 * 24 * 30

class OutputEnumeration:
  # Class encapsulating logic which represents the logical output of the API
  # per source event, for the purposes of debiasing the randomized response
  # privacy mechanism.
  def __init__(self, report_tuple: OutputConfig, params: ParamConfig):
    '''report_tuple must be in the form ((window_index, trigger_data),...)'''
    self.output: OutputConfig = tuple(sorted(report_tuple))
    self.params = params    

  def __str__(self):
    def report_to_string(r):
      if r is None:
        return 'No report'
      return {'window': r[0], 'data': r[1]}
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
    '''Create an output directly from structured data

    source_with_reports: list of (source, [report, ...]) tuples.
    See get_conversion_counts for expected structure for sources and reports.
    '''
    source, reports = source_with_reports
    params = EVENT_PARAMS if source['source_type'] == 'event' else NAV_PARAMS
    max_reports = params.max_reports
    assert len(reports) <= max_reports

    def parse_report(source, report: dict) -> Tuple[int, int]:
      window_index = OutputEnumeration._get_window_index_for_report(
          source, report)
      trigger_data = int(report['report']['trigger_data'])
      return (window_index, trigger_data)

    return cls(tuple(parse_report(source, r) for r in reports), params)


  @classmethod
  def generate_all(cls, params: ParamConfig) -> OutputEnumerationGen:
    """Generator to generate every single possible OutputEnumeration for the given `params`"""
    def gen_all(max_reports, index, output_so_far) -> OutputEnumerationGen:
      """Helper generator which aggregates outputs in `output_so_far` recursively"""
      yield cls(tuple(output_so_far), params)
      if max_reports == 0:
        return

      # Build up `output_so_far` recursively.
      # 1. Insert the report specified by the current index
      # 2. Recurse down to build up the remaining reports conditioned on
      #    indices >= the current index.
      # The condition in step 2 is important because it means we keep a constraint
      # where `output_so_far` is increasing in indices and that we don't generate
      # duplicate outputs like reports indexed by (1,2,3) and (3,2,1).
      for next_index in range(index, params.data_cardinality * params.max_windows):
        window, data = divmod(next_index, params.data_cardinality)
        output_so_far.append((window, data))
        yield from gen_all(max_reports - 1, next_index, output_so_far)
        output_so_far.pop()
    return gen_all(params.max_reports, 0, [])


  def data_histogram(self) -> numpy.ndarray:
    '''Returns the number of reports associated with this output, broken
    out by the trigger_data'''

    return numpy.bincount([o[1] for o in self.output], minlength=self.params.data_cardinality)

  def get_report_time(self, window: int, source: Source) -> int:
    """For a given Source and window index, returns the estimated report time.
    This is used for generating synthetic event-level reports"""
    expiry = source['registration_config'].get('expiry', DEFAULT_EXPIRY)
    if self.params.name == 'event':
      return expiry

    # TODO(csharrison): This assumes the expiry > 7 days.
    windows = [timedelta(days=2), timedelta(days=7), timedelta(seconds=expiry)]
    source_time = source['source_time']
    return int(source_time + windows[window].total_seconds())

  def generate_reports_for_source(self, source: Source) -> List[Report]:
    assert self.params.name == source['source_type']
    source_event_id = source['registration_config']['source_event_id']

    reports: List[Report] = []
    for window, trigger_data in self.output:
      reports.append({
          'report_time': self.get_report_time(window, source),
          'report': {
              'source_event_id': source_event_id,
              'source_type': self.params.name,
              'trigger_data': str(trigger_data)
          }
      })
    return reports

  @staticmethod
  def _get_window_index_for_report(source: dict, report: dict) -> int:
    if source['source_type'] == 'event':
      return 0

    report_time = report['report_time']
    source_time = source['source_time']
    raw_expiry = source['registration_config'].get('expiry', DEFAULT_EXPIRY)
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
def estimate_true_values(observed_values: Dict[T, int],
                         randomized_response_rate: float) -> Dict[T, float]:
  '''Returns a list of corrected counts

  observed_values: A map of size `k` for k-ary randomized response. Each item
                   represents a randomized response output as the key, with its
                   associated count as the value.

  randomized_response_rate: The probability any given output is randomized
  '''
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


def join_reports_with_sources(sources: List[Source], reports: List[Report]) -> JoinedGen:
  '''Returns tuple of (source, [reports]) joined with the source_event_id'''
  report_map = collections.defaultdict(list)
  for r in reports:
    report_map[r['report']['source_event_id']].append(r)

  def join(source) -> Joined:
    source_event_id = source['registration_config']['source_event_id']
    return (source, report_map[source_event_id])
  return (join(s) for s in sources)


################## AGGREGATE UTILITIES ##################

def get_raw_corrected_map(joined: Iterable[Joined], params: ParamConfig) -> Dict[OutputEnumeration, float]:
  '''Returns an aggregate map of OutputEnumeration -> float, with noise debiased
  according to params. Each returned float is an estimate count for how many times the
  given OutputEnumeration showed up in `joined`'''
  output_counts = {o: 0 for o in OutputEnumeration.generate_all(params)}
  for j in joined:
    output = OutputEnumeration.create_from_data(j)
    assert output in output_counts
    output_counts[output] += 1

  return estimate_true_values(output_counts, params.rr_rate)


def correct_aggregates(joined: JoinedGen, params: ParamConfig) -> List[dict]:
  '''Returns debiased report counts broken out by trigger_data'''
  corrected = get_raw_corrected_map(joined, params)
  histogram = numpy.zeros(params.data_cardinality)
  for o, c in corrected.items():
    histogram += c * o.data_histogram()
  x = 10
  return [{'trigger_data': t,
           'report_count': v} for t, v in enumerate(histogram)]


################## EVENT-LEVEL UTILITIES ##################

def adjust_to_match_distribution(values: List[T],
                                 estimated_counts: Dict[T, float],
                                 default_value: T) -> List[T]:
  '''Given a list of values, and an aggregate map that counts all possible values,
  returns a list of adjusted values to match the aggregate distribution.

  values: list of arbitrary objects (must be possible to place in dict/set). To
          minimize bias, this list should be shuffled prior to calling this
          method.
  estimated_counts: map of value -> estimated count. All values in `values` must be
                    present. Note that negatives are allowed, but they will be
                    clamped to 0 internally. Note that because the we cannot
                    assign any output less than 0, the end values will always be
                    biased.
  default_value: a default / null value

  The algorithm used in this method attempts to achieve two goals:
  1. The output values match the distribution as much as possible, minimizing
     bias.
  2. The output maximizes 'overlap' with the input. That is, satisfying (1), we
     want to minimize the number of inputs that are adjusted.
  '''

  # Split the distribution into two chunks: elements with mass >= 1 and not.
  # Clamp negatives to 0. Note this introduces bias, but it seems unavoidable.
  large_elts = {k: v for k, v in estimated_counts.items() if v >= 1}
  small_elts = {k: max(0, v) for k, v in estimated_counts.items() if v < 1}
  assert len(small_elts) + len(large_elts) == len(estimated_counts)

  def decrement_large_elt(elt):
    large_elts[elt] -= 1
    if large_elts[elt] < 1:
      small_elts[elt] = large_elts[elt]
      large_elts.pop(elt)

  def handle_value(val):
    assert val in estimated_counts and (val in small_elts or val in large_elts)
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


def generate_corrected_event_level(joined: JoinedList, params: ParamConfig) -> JoinedList:
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

  def adjust_json(j, adjusted) -> Joined:
    source: Source = j[0]
    adjusted_reports: List[Report] = adjusted.generate_reports_for_source(
        source)
    return (source, adjusted_reports)

  return [adjust_json(j, a) for j, a in zip(joined, adjusted_values)]


def main():
  DESCRIPTION = '''\
  noise_corrector.py is a command-line tool that attempts to debias the noise
  output in the Attribution Reporting API for event-level reports. It takes as
  input JSON files which represent source registrations and the resulting
  event-level reports. It can provide debiased output in aggregate, or via
  generating synthetic event-level data.

  The noise added in the API is described at:
  https://github.com/WICG/conversion-measurement-api/blob/main/EVENT.md#data-limits-and-noise
  This utility expects JSON input coming from stdin in the following format:
  {
    "input": {
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
            "expiry": 864000000,
          }
        },
        ...
      ]
    },
    // List of zero or more reports.
    "reports": [
      {
        // Time at which the report would have been sent in seconds since the
        // UNIX epoch.
        "report_time": 123,

        // The report itself.
        "report": {
          "source_event_id": "1337",
          "source_type": "navigation",

          // Coarse data set in the attribution trigger registration
          "trigger_data": "4"ß
        }
      },
      ...
    ]
  }
  '''
  parser = argparse.ArgumentParser(
      description=DESCRIPTION, formatter_class=argparse.RawTextHelpFormatter)

  INPUT_MODE_HELP = '''\
  Optional. One of `single` or `multi`. Defaults to `single`, which reads all of
  stdin as one JSON file, with the format above. `multi` mode accepts input in
  the JSON-lines format, where every separate line of input follows the above
  format. It is expected in `multi` mode that events from a given browser are
  isolated in a particular line of input (i.e. the tool will treat data on
  different lines completely independently).
  '''
  parser.add_argument('--input_mode', dest='input_mode',
                      choices=['single', 'multi'],
                      default='single', help=INPUT_MODE_HELP)

  OUTPUT_MODE_HELP = '''\
  Optional. One of `experimental-event-level` or `aggregate`. Defaults to
  `aggregate`, which provides aggregate counts for different trigger data
  values. The `experimental-event-level` mode outputs synthetic sources and
  their associated reports matching the debiased aggregate data as best as
  possible. In other words, the tool will mutate the input reports in some way
  (sometimes by generating new reports that were not input into the system) so
  that the output event-level data, when aggregated, matches the data that
  `aggregate` mode would return.

  Note: the `experimental-event-level` format is experimental. More work is
  needed to make sure the use-cases for it are well-understood.

  `aggregate` output format:
  {
    "navigation": [
      {
        "trigger_data": 0,
        "report_count": <count>
      },
    ...
    ],
    "event": [
      {
        "trigger_data": 0,
        "report_count": <count>
      },
      ...
    ]
  }

  `experimental-event-level` output format:
  [
    {
      "source": <source, same as input format>
      "reports": <same as input reports format>
    },
    ...
  ]
  '''
  parser.add_argument('--output_mode', dest='output_mode',
                      choices=['experimental-event-level', 'aggregate'],
                      default='aggregate', help=OUTPUT_MODE_HELP)

  parser.add_argument('-v', '--version', action='version', version=VERSION)

  args = parser.parse_args()

  def gen_joined() -> JoinedGen:
    if args.input_mode == 'single':
      input = json.load(sys.stdin)
      yield from join_reports_with_sources(input['input']['sources'], input['reports'])
    else:
      for line in sys.stdin:
        input = json.loads(line)
        yield from join_reports_with_sources(input['input']['sources'], input['reports'])

  joined = gen_joined()
  navs: JoinedGen = (s for s in joined if s[0]['source_type'] == 'navigation')
  events: JoinedGen = (s for s in joined if s[0]['source_type'] == 'event')

  if args.output_mode == 'aggregate':
    print(json.dumps({
        'navigation': correct_aggregates(navs, NAV_PARAMS),
        'event': correct_aggregates(events, EVENT_PARAMS),
    }, indent=2))

  elif args.output_mode == 'experimental-event-level':
    nav_corrected = generate_corrected_event_level(list(navs), NAV_PARAMS)
    event_corrected = generate_corrected_event_level(list(events), EVENT_PARAMS)
    combined = [{'source': s, 'reports': r}
                for s, r in nav_corrected + event_corrected]
    print(json.dumps(combined, indent=2))


if __name__ == '__main__':
  main()
