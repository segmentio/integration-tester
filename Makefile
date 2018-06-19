
test: install
	@node_modules/.bin/mocha -t 300ms

node_modules: package.json $(wildcard node_modules/*/package.json)
	@yarn install --pure-lockfile
	@touch $@

install: node_modules

.PHONY: test install
