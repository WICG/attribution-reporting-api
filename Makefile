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

validator: $(OUT_DIR)/validate-headers.html $(OUT_DIR)/validate-headers.js $(OUT_DIR)/filters.html $(OUT_DIR)/filters-main.js

$(OUT_DIR)/validate-headers.html: ts/src/header-validator/index.html $(OUT_DIR)
	@ cp $< $@

$(OUT_DIR)/validate-headers.js: ts/dist/header-validator/index.js $(OUT_DIR)
	@ cp $< $@

$(OUT_DIR):
	@ mkdir -p $@

ts/dist/header-validator/index.js ts/dist/header-validator/filters-main.js: ts/package.json ts/tsconfig.json ts/webpack.config.js ts/src/*.ts ts/src/*/*.ts
	@ npm ci --prefix ./ts
	@ npm run pack --prefix ./ts

clean:
	@ rm -rf $(OUT_DIR)

$(OUT_DIR)/filters.html: ts/src/header-validator/filters.html $(OUT_DIR)
	@ cp $< $@

$(OUT_DIR)/filters-main.js: ts/dist/header-validator/filters-main.js $(OUT_DIR)
	@ cp $< $@
