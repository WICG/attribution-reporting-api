import argparse
import collections
import functools
import json
from math import log, exp
import sys
from typing import Tuple, TypedDict, List, NamedTuple

# Each per-trigger-data config specifies (num_windows, num_buckets)
PerTriggerDataConfig = List[Tuple[int, int]]


class ApiConfig(NamedTuple):
    max_event_level_reports: int
    per_trigger_data_configs: PerTriggerDataConfig


def num_flexible_states(config: ApiConfig) -> int:
    """Returns the total number of output states for a given configuration of
       the flexible event-level API

    Args:
    max_event_level_reports: The value of `max_event_level_reports` in the source registration.
    per_type_configs: A list of tuples of (num_windows, num_summary_buckets), per `trigger_data`
    """

    # Let B be the trigger data cardinality.
    # For every trigger data i, there are w_i windows and c_i maximum reports / summary buckets.
    # The following helper function memoizes the recurrence relation:
    # 1. A[C, w_1, ..., w_B, c_1, ... , c_B] = 1 if B = 0
    # 2. A[C, w_1, ..., w_B, c_1, ... , c_B] = A[C, w_1, ..., w_{B-1}, c_1, ... , c_{B-1}] if w_B = 0
    # 3. A[C, w_1, ..., w_B, c_1, ... , c_B] = sum(A[C - j, w_1, ..., w_B - 1, c_1, ... , c_B - j], j from 0 to min(c_B, C)) otherwise
    @functools.lru_cache(maxsize=None)
    def helper(total_cap: int, index: int, w: int, c: int) -> int:
        # Case 1.
        if index == 0 and w == 0:
            return 1

        # Case 2.
        if w == 0:
            trigger_config = config.per_trigger_data_configs[index - 1]
            return helper(total_cap, index - 1, trigger_config[0], trigger_config[1])

        # Case 3.
        return sum(helper(total_cap - i, index, w - 1, c - i) for i in range(min(c, total_cap) + 1))

    last_config = config.per_trigger_data_configs[-1]
    data_cardinality = len(config.per_trigger_data_configs)
    return helper(config.max_event_level_reports, data_cardinality - 1, last_config[0], last_config[1])


def h(x: float) -> float:
    """Evaluates the binary entropy function.

    Args:
    x: the input value.

    Returns:
      The binary entropy function at x.
    """
    if x == 0 or x == 1:
        return 0
    else:
        return - x * log(x, 2) - (1 - x) * log(1 - x, 2)


def flip_probability_dp(num_states: int, epsilon: float) -> float:
    """Returns the flip probability to satisfy epsilon differential privacy.

       Uses the k-RR privacy mechanism.
    """
    return num_states / (num_states + exp(epsilon) - 1)


def capacity_q_ary_symmetric_channel(log2_q: float,
                                     flip_probability: float) -> float:
    """Computes the capacity of the q-ary symmetric channel.

    Args:
      log2_q: the logarithm to base 2 of the alphabet size.
      flip_probability: the channel keeps the input the same with probability
        1 - flip_probability, and flips the input to one of the other q - 1
        symbols (uniformly) with the remaining probability of flip_probability.

    Returns:
      The capacity of the q-ary symmetric channel for given flip_probability.
        In general, the capacity is defined as the maximum, over all input
        distributions, of the mutual information between the input and output of
        the channel. In the special case of the q-ary symmetric channel, a
        closed-form expression is known, which we use here.
    """
    return (log2_q - h(flip_probability) - flip_probability * log(2**log2_q - 1, 2))


def max_information_gain(num_states: int, epsilon: float):
    """Returns the maximum information for a source using the flexible event API."""

    flip_prob = flip_probability_dp(num_states, epsilon)
    return capacity_q_ary_symmetric_channel(log(num_states, 2),
                                            flip_prob*(num_states-1)/num_states)


def get_config(json: dict, source_type: str) -> ApiConfig:
    default_max_reports = 3 if source_type == "navigation" else 1
    max_event_level_reports = json.get('max_event_level_reports', default_max_reports)
    per_trigger_data_configs = []
    for spec in json['trigger_specs']:
        num_data_types = len(spec['trigger_data'])
        num_windows = len(spec['event_report_windows']['end_times'])

        # Technically this can be larger, but we will always be constrained
        # by `max_event_level_reports`.
        num_buckets = len(spec['summary_buckets']
                          ) if 'summary_buckets' in spec else max_event_level_reports
        per_trigger_data_configs.extend(
            [(num_windows, num_buckets)] * num_data_types)

    return ApiConfig(max_event_level_reports, per_trigger_data_configs)


NAVIGATION_DEFAULT_CONFIG = ApiConfig(3, [(3, 3)] * 8)
EVENT_DEFAULT_CONFIG = ApiConfig(1, [(1, 1)] * 2)


def print_config_data(config: ApiConfig, epsilon: float, source_type: str):
    num_states = num_flexible_states(config)
    info_gain = max_information_gain(num_states, epsilon)
    flip_prob = flip_probability_dp(num_states, epsilon)

    print(f"Number of possible different output states: {num_states}")
    print(f"Information gain: {info_gain:.2f} bits")
    print(f"Flip percent: {100 * flip_prob:.5f}%")

    info_gain_default_nav = max_information_gain(
        num_flexible_states(NAVIGATION_DEFAULT_CONFIG), args.epsilon)
    info_gain_default_event = max_information_gain(
        num_flexible_states(EVENT_DEFAULT_CONFIG), args.epsilon)
    if source_type == "navigation" and info_gain > info_gain_default_nav:
        print(
            f"WARNING: info gain of {info_gain:.2f} > {info_gain_default_nav:.2f} for navigation sources")
    if source_type == "event" and info_gain > info_gain_default_event:
        print(
            f"WARNING: info gain of {info_gain:.2f} > {info_gain_default_event:.2f} for event sources")


if __name__ == "__main__":
    DESCRIPTION = '''\
  flexible_event_privacy.py is a utility to ingest configurations for the flexible
  event-level reports in the Attribution Reporting API. It reads a JSON from stdin
  matching the input in the request header Attribution-Reporting-Register-Source.

  It optionally also accepts windows and per-trigger-data summary buckets from command
  line arguments.

  The output of this tool prints diagnostics about the config, including how many
  output states it encodes, the flip probability for a certain epsilon value (default 14),
  and the maximum information gain obtained from one source. The tool will also emit a
  warning if the information gain exceeds the default configs for navigation or event
  sources.

  Caution: JSON input is not completely validated. It is minimally processed to count the
  number of windows and buckets per trigger spec.
  '''

    parser = argparse.ArgumentParser(
        description=DESCRIPTION, formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument('-m', '--max_event_level_reports',
                        type=int, default=20)
    parser.add_argument('-e', '--epsilon', type=float, default=14)

    TYPE_HELP = '''\
  Enum representing whether this source is a navigation or event source. Defaults to
  a navigation source.
  '''
    parser.add_argument('-t', '--source_type',
                        choices=["event", "navigation"], default="navigation")

    def comma_separated_ints(string):
        return [int(i) for i in string.split(',')]

    WINDOW_HELP = '''\
  Comma separated integers representing the number of reporting windows
  for each possible trigger_data.
  '''
    parser.add_argument('-w', '--windows',
                        type=comma_separated_ints, help=WINDOW_HELP)

    BUCKETS_HELP = '''\
  Comma separated integers representing the maximum number of summary buckets
  for each possible trigger_data.
  '''
    parser.add_argument('-b', '--buckets',
                        type=comma_separated_ints, help=BUCKETS_HELP)
    args = parser.parse_args()

    api_config: ApiConfig = None
    if args.windows and args.buckets:
        assert len(args.windows) == len(args.buckets)
        per_trigger_configs = list(zip(args.windows, args.buckets))
        api_config = ApiConfig(
            args.max_event_level_reports, per_trigger_configs)
    else:
        api_config = get_config(json.load(sys.stdin))
    print_config_data(api_config, args.epsilon, args.source_type)
