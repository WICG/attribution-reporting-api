SHELL = /bin/bash
OUT_DIR ?= out

.PHONY: clean

$(OUT_DIR)/index.html: index.bs $(OUT_DIR)
	@ (HTTP_STATUS=$$(curl https://api.csswg.org/bikeshed/ \
                                --output $@ \
	                       --write-out '%{http_code}' \
	                       --header 'Accept: text/plain, text/html' \
	                       -F die-on=warning \
	                       -F file=@$<) && \
	[[ "$$HTTP_STATUS" -eq "200" ]]) || ( \
		echo ""; cat $@; echo ""; \
		rm $@; \
		exit 22 \
	);

$(OUT_DIR):
	@ mkdir -p $@

clean:
	@ rm -rf $(OUT_DIR)
