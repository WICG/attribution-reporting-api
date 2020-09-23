import collections
import random

# This file provides a helper function to denoise reports coming
# from the event level API (i.e. those where conversion metadata
# is potentially randomly selected).

# TODO(csharrison): This estimator is unbiased, but its variance
# can be improved if we add bias. This is something we should
# be able to smoothly trade off with another parameter.
def corrected_buckets(buckets, noise_probability=.05):
  """Returns a map of conversion bits --> corrected counts

  buckets: A map from integer conversion metadata to conversion counts.
       note, this needs to include buckets with 0 counts.
  noise_probability: The probability the metadata was randomly selected
  """

  total_records = sum(buckets.values())
  num_conversion_buckets = len(buckets)

  # |noise_probability| of the reports are noised and uniformly distributed
  # among the conversion buckets so one can calculate how many values have
  # were from noised, per bucket.
  noised_values_per_bucket = total_records * noise_probability / num_conversion_buckets

  # Subtract the reports added to each bucket due to noise, and rescale to
  # account for the reports that were shifted due to the initial noise.
  corrected_buckets = {
      bucket: (v - noised_values_per_bucket) / (1 - noise_probability)
      for bucket, v in buckets.items()
  }
  return corrected_buckets

if __name__ == "__main__":
  # The following is an example showing how to use the function.
  # |example_reports| is a map from bucket --> count of conversions
  # with that bucket.
  example_reports = {
      0: 50,
      1: 150,
      2: 300,
      3: 400,
      4: 700,
      5: 200,
      6: 0,
      7: 2000
  }

  # Simulate the API randomly flipping reports
  noisy_reports = collections.defaultdict(int)
  buckets = list(example_reports.keys())
  noise_probability = .05
  for bucket, count in example_reports.items():
    for r in range(count):
      if random.random() <= noise_probability:
        new_bucket = random.choice(buckets)
        noisy_reports[new_bucket] += 1
      else:
        noisy_reports[bucket] += 1

  corrected = corrected_buckets(noisy_reports, noise_probability)

  print("Bucket\ttrue count\tnoisy count\tcorrected count")
  for bucket, count in corrected.items():
    print("%d\t%d\t%d\t%f.1" % (bucket, example_reports[bucket], noisy_reports[bucket], count))
