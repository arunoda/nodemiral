var SSH = require('../lib/ssh');
var SSH2 = require('ssh2');
var sinon = require('sinon');
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;

suite('SSH', function() {
  suite('_onReady', function() {
    test('listen before ready', function(done) {
      var client = new SSH();
      client._onReady(done);
      client._client.emit('ready');
    });

    test('listen after ready', function(done) {
      var client = new SSH();
      client._client.emit('ready');
      client._onReady(done);
    });
  });

  suite('execute', function() {
    test('execute and error', function(done) {
      var client = new SSH();
      client._client.emit('ready');
      var command = "the-command";

      client._client.exec = sinon.stub();
      client._client.exec.callsArgWith(1, new Error());

      client.execute(command, function(err) {
        assert.ok(err);
        done();
      });
    });

    test('execute and stream', function(done) {
      var client = new SSH();
      client._client.emit('ready');
      var command = "the-command";

      client._client.exec = sinon.stub();
      var stream = new EventEmitter();
      stream.stderr = new EventEmitter();

      client._client.exec.callsArgWith(1, null, stream);

      var options = {
        onStdout: sinon.mock(),
        onStderr: sinon.mock()
      };

      client.execute(command, options, function(err, context) {
        assert.ifError(err);
        assert.deepEqual(context, {
          code: 0,
          signal: 'SIGINT',
          stderr: 'stderr',
          stdout: 'stdout'
        })

        assert.equal(options.onStdout.args[0][0], 'stdout');
        assert.equal(options.onStderr.args[0][0], 'stderr');
        done();
      });

      stream.emit('data', new Buffer('stdout'));
      stream.stderr.emit('data', new Buffer('stderr'));
      stream.emit('close', 0, 'SIGINT');
    });
  });
});