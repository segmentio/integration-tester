
# integration-tester

  Integration tester.

## Installation

```bash
$ npm install segmentio/integration-tester
```

## Example

```js
assert(integration)
  .identify(identify)
  .sends('content-type', 'application/json')
  .sends({ baz: 'foo' })
  .expects({ users: { name: 'baz' } })
  .expects(200, end);
```

```js
assert(integration)
  .sends('content-type', 'text/plain')
  .sends('x-baz', /foo/)
  .sends(/key=111/)
  .sends(/type=identify/)
  .expects(/success=true/)
  .expects(200, done);
```

## API

#### Assertion(integration)

  Initialize new Assertion with `integration`.

##### set(key, value)

  Set object `key` or `key, value` settings.

##### sends(...)

  Assert integration sends `...`

    // examples
    sends({ baz: 'foo' });
    sends(/baz=foo/);
    sends('?query=string');
    sends('baz=foo');

##### expects(...)

  Assert integration expects `...`

    // examples
    expects({ success: true });
    expects(/success=true/);
    expects('success=true');
    expects(200);

##### end(fn)

  End assertions with `fn`.

##### error(fn)

  Assert integration calls `fn(err)`.

##### enabled(facade)

  `true` if integration is enabled for `facade`

##### disabled(facade)

  `true` if integration is disabled for `facade`.

##### CHANNEL(msg)

  `true` if integration is enabled on `channel` with optional `msg`.

    // examples
    server();
    client();
    mobile();

##### all()

  `true` if integration is enabled on all channels.

## License

  (MIT)

