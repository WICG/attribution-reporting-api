SHELL = /bin/bash
OUT_DIR ?= out

.PHONY: all clean validator

all: $(OUT_DIR)/index.html validator

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

validator: $(OUT_DIR)/validate-headers.html $(OUT_DIR)/validate-headers.js

$(OUT_DIR)/validate-headers.html: header-validator/index.html $(OUT_DIR)
	@ cp $< $@

$(OUT_DIR)/validate-headers.js: header-validator/dist/main.js $(OUT_DIR)
	@ cp $< $@

$(OUT_DIR):
	@ mkdir -p $@

header-validator/dist/main.js: header-validator/package.json header-validator/webpack.config.js header-validator/src/*.ts
	@ npm ci --prefix ./header-validator
	@ npm run build --prefix ./header-validator

clean:
	@ rm -rf $(OUT_DIR)
