var TaskList = require('../lib/taskList');
var assert = require('assert');

suite('TaskList', function() {
  test('register and run', function(done) {
    var optionsList = [];
    var session = {};
    TaskList.registerTask('simpleTask', function(_session, options, callback) {
      assert.equal(session, _session);
      optionsList.push(options);
      callback();
    });

    var taskList = new TaskList('simple', {pretty: false});
    taskList.simpleTask('Simple Name', {aa: 10});
    taskList.simpleTask('Simple Name2', {aa: 20});
    taskList.run(session, function(errors) {
      assert.deepEqual(errors, []);
      assert.deepEqual(optionsList, [{aa: 10}, {aa: 20}]);
      done();
    });
  });
});