
# integration-tester

  Integration tester.

[![Build Status](https://circleci.com/gh/segmentio/integration-tester.png?circle-token=5661c08914a340dcbb99e778e72c18641b9f8576)](https://circleci.com/gh/segmentio/integration-tester)

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

##### .requests(n)

  Assert requests are `n`.

##### .retries(n)

  Assert retries are `n`.

##### .timeout(ms)

  Assert timeout is `ms`, where `ms` can be either a string (`2s`) or a number (`2000`).

##### .name(name)

  Assert name is `n`.

##### .endpoint(url)

  Assert endpoint is `url`.

##### .valid(msg, settings)

  Assert the integration is valid with `msg`, `settings`.

##### query(obj)

  Add query.

  Example:

    Assertion(integration)
      .set('token', 'e16481cb')
      .identify({ userId: 1 })
      .query({ identify: true })
      .query({ userid: 1 })
      .expects(200, done);

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

##### enabled(msg)

  throws if the integration isn't enabled on `msg`.

##### disabled(msg)

  throws if the integration isn't disabled on `msg`.

##### CHANNEL(msg)

  throws if the integration isn't enabled on `channel` with optional `msg`.

    // examples
    server();
    client();
    mobile();

##### all()

  throws if the integration isn't enabled on all channels.

## License

  (MIT)

