#!/bin/bash

# So we can see what we're doing
set -x

# Exit with nonzero exit code if anything fails
set -e

# Run bikeshed.  If there are errors, exit with a non-zero code
HTTP_RESPONSE=$(curl -s -o index.html -w "%{http_code}" https://api.csswg.org/bikeshed/ -F file=@index.bs -F force=1)

# The out directory should contain everything needed to produce the
# HTML version of the spec.
if [ $HTTP_RESPONSE -eq "200" ]; then
  mkdir -p out
  mv index.html out
else
  cat index.html
  rm -f index.html
  exit 22
fi

