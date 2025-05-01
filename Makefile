SHELL = /bin/bash
OUT_DIR ?= out

.PHONY: all clean validator

all: $(OUT_DIR)/index.html validator

venv-marker := venv/.make
bikeshed := venv/bin/bikeshed
venv: $(venv-marker)

$(venv-marker): Makefile
	python3 -m venv venv
	@touch $@

$(bikeshed): $(venv-marker) Makefile
	venv/bin/pip install $(notdir $@)
	@touch $@

$(OUT_DIR)/index.html: index.bs $(OUT_DIR) $(bikeshed)
	$(bikeshed) --die-on=warning spec $< $@

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
	@ rm -rf $(OUT_DIR) venv

$(OUT_DIR)/filters.html: ts/src/header-validator/filters.html $(OUT_DIR)
	@ cp $< $@

$(OUT_DIR)/filters-main.js: ts/dist/header-validator/filters-main.js $(OUT_DIR)
	@ cp $< $@
