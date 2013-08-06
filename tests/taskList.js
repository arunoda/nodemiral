var TaskList = require('../lib/taskList');
var assert = require('assert');

suite('TaskList', function() {
  test('register and run', function(done) {
    var optionsList = [];
    var session = {_host: 'host'};
    TaskList.registerTask('simpleTask', function(_session, options, callback) {
      assert.equal(session, _session);
      optionsList.push(options);
      callback();
    });

    var taskList = new TaskList('simple', {pretty: false});
    taskList.simpleTask('Simple Name', {aa: 10});
    taskList.simpleTask('Simple Name2', {aa: 20});
    taskList.run(session, function(summeryMap) {
      assert.ok(summeryMap[session._host]);
      assert.deepEqual(optionsList, [{aa: 10}, {aa: 20}]);
      done();
    });
  });

  test('when error', function(done) {
    var session = {_host: 'host'};
    TaskList.registerTask('simpleTask2', function(_session, options, callback) {
      assert.equal(session, _session);
      if(options.aa == 20) {
        callback(new Error('error-here'));
      } else {
        callback();
      }
    });

    var taskList = new TaskList('simple', {pretty: false});
    taskList.simpleTask2('one', {aa: 10});
    taskList.simpleTask2('two', {aa: 20});
    taskList.simpleTask2('three', {aa: 30});
    taskList.run(session, function(summeryMap) {
      assert.ok(summeryMap[session._host]);
      assert.deepEqual(summeryMap[session._host], [
        {action: 'one', status: 'SUCCESS'},
        {action: 'two', status: 'FAILED', error: 'error-here'}
      ]);
      done();
    });
  });

  test('when error - with ignoreErrors', function(done) {
    var session = {_host: 'host'};
    TaskList.registerTask('simpleTask3', function(_session, options, callback) {
      assert.equal(session, _session);
      if(options.aa == 20) {
        callback(new Error('error-here'));
      } else {
        callback();
      }
    });

    var taskList = new TaskList('simple', {pretty: false, ignoreErrors: true});
    taskList.simpleTask3('one', {aa: 10});
    taskList.simpleTask3('two', {aa: 20});
    taskList.simpleTask3('three', {aa: 30});
    taskList.run(session, function(summeryMap) {
      assert.ok(summeryMap[session._host]);
      assert.deepEqual(summeryMap[session._host], [
        {action: 'one', status: 'SUCCESS'},
        {action: 'two', status: 'FAILED', error: 'error-here'},
        {action: 'three', status: 'SUCCESS'},
      ]);
      done();
    });
  });
});