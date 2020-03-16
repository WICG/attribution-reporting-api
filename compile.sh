#!/bin/bash

# So we can see what we're doing
set -x

# Exit with nonzero exit code if anything fails
set -e

# Run bikeshed.  If there are errors, exit with a non-zero code
curl https://api.csswg.org/bikeshed/ -F file=@index.bs -F force=1 > index.html;

# The out directory should contain everything needed to produce the
# HTML version of the spec.

mkdir -p out
mv index.html out
