
1.0.5 / 2014-10-03
==================

  * bumping facade dependency

1.0.4 / 2014-09-23
==================

 * multi: fix query assertions

1.0.3 / 2014-09-01
==================

 * add response hack
 * add .error(msg, fn) support
 * add initial multi-request support

1.0.2 / 2014-08-27
==================

 * deps: upgrade integration

1.0.1 / 2014-08-27
==================

 * fix settings

1.0.0 / 2014-08-27
==================

 * .end(): pass response back
 * .fixture(): clone
 * validations: move to array
 * maps(): map ecommerce events correctly
 * .ensure(): add more tests
 * .ensure(): add more tests
 * .ensure(): fix typo
 * remove option(), requires(), .enabled() and add .ensure()
 * settings: dont pass settings to methods
 * option(), clone option before comparing
 * .validate(): now a static method.
 * .channels(): sort to remove annoying errors
 * add .requires()
 * allow chaining with .option(), .channels()
 * add .option(name, meta)
 * add .channels(arr) assertion
 * .maps(): respect ecommerce mappings
 * .end(): dont throw when no requests are created for now
 * .end(): throw if no request was created
 * .end(): return an error if the method is not implemented
 * Merge pull request #20 from segmentio/query
 * .query(): add .query(key, value, parse) implementation
 * .query(): add key, value, parse tests
 * query(): add key, value implementation
 * query: add query(key, value) tests
 * add .mapper(mapper)
 * add .fixture(name) -- loads a fixture
 * .fixture() -> .maps()
 * .fixture(): merge settings when possible
 * Merge pull request #18 from segmentio/add/fixture
 * add .fixture()
 * .pathname(): add better err msg
 * docs
 * Merge pull request #17 from segmentio/add/path
 * Add request pathname assertion
 * createFacade() -> toMessage()
 * add .invalid(msg, settings)
 * add .valid(msg, settings)
 * tests: add .end() test to prevent regression
 * add .requests(n) assertion
 * add .errorf() to reduce ll
 * Merge pull request #16 from segmentio/throw
 * docs
 * .retries(): add impl
 * .retries(): add tests
 * .name(): add impl
 * .name(): add tests
 * .timeout(): add impl
 * .timeout(): add tests
 * .endpoint(): add impl
 * .endpoint(): add tests
 * make sure .CHANNEL(), .enabled(), .disabled() throw
 * tests: remove should
 * ocd
 * refactor: less files

0.1.1 / 2014-06-24
==================

 * updating facade dep
 * .CHANNEL(): make sure facade instance is created / augmented, fixes #9

0.1.0 / 2014-06-12
==================

 * add .query(), closes #3
 * .enabled(): pass settings too, closes #5
 * add circle ci
 * Merge pull request #8 from segmentio/fix-and-simplify-inspect
 * use express@3. fixes #6
 * fix and simplify util.inspect()
 * fix .toString()
 * docs
 * add .error()
 * return boolean from .all() and .CHANNEL()
 * add optional msg to .all() & .CHANNEL()
 * api docs
 * add .enabled() helpers
 * add querystring tests
 * add more tests, closes #1
 * Initial commit
