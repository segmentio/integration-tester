
test: install
	@node_modules/.bin/mocha -t 300ms

install:
	yarn install --frozen-lockfile

.PHONY: test install
