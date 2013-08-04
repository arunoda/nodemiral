var Session = require('../lib/session');
var assert = require('assert');
var fs = require('fs');

suite('Session', function() {
  suite('.copy()', function() {
    test('with password', function(done) {
      var session = new Session('host', {username: 'root', password: 'kuma'});
      session._doSpawn = function(command, callback) {
        assert.equal(command, 'sshpass -p kuma scp ./src root@host:~/dest');
        callback();
      };
      session.copy('./src', '~/dest', done);
    });

    test('with pem', function(done) {
      var session = new Session('host', {username: 'root', pem: './aa.pem'});
      session._doSpawn = function(command, callback) {
        assert.equal(command, 'scp -i ./aa.pem ./src root@host:~/dest');
        callback();
      };
      session.copy('./src', '~/dest', done);
    });

    test('no pem or password', function(done) {
      var session = new Session('host', {username: 'root'});
      assert.throws(function() {
        session.copy('./src', '~/dest', done);
      });
      done();
    });
  });

  suite('.execute()', function() {
    test('with password', function(done) {
      var session = new Session('host', {username: 'root', password: 'kuma'});
      session._doSpawn = function(command, callback) {
        assert.equal(command, 'sshpass -p kuma ssh root@host ls /');
        callback();
      };
      session.execute('ls /', done);
    });

    test('with pem', function(done) {
      var session = new Session('host', {username: 'root', pem: './aa.pem'});
      session._doSpawn = function(command, callback) {
        assert.equal(command, 'ssh -i ./aa.pem root@host ls /');
        callback();
      };
      session.execute('ls /', done);
    });

    test('no password or pem', function(done) {
      var session = new Session('host', {username: 'root'});
      assert.throws(function() {
        session.execute('ls /', done);
      });
      done();
    });
  });

  suite('.executeScript', function() {
    test('file exists', function(done) {
      var session = new Session('host', {username: 'root', password: 'kuma'});
      session.execute = function(shellCommand, callback) {
        assert.equal(shellCommand, 'ls -all /');
        callback();
      };
      var file = '/tmp/' + Math.ceil(Math.random() * 9999999);
      fs.writeFileSync(file, 'ls -all /');
      session.executeScript(file, function() {
        fs.unlinkSync(file);
        done();
      });
    });

    test('file not exists', function(done) {
      var session = new Session('host', {username: 'root', password: 'kuma'});
      session.execute = function(shellCommand, callback) {
        assert.equal(shellCommand, 'ls -all /');
        callback();
      };

      session.executeScript('/tmp/ssdcs', function(err) {
        assert.ok(err);
        done();
      });
    });

    test('with ejs', function(done) {
      var session = new Session('host', {username: 'root', password: 'kuma'});
      session.execute = function(shellCommand, callback) {
        assert.equal(shellCommand, 'ls -all /');
        callback();
      };
      var file = '/tmp/' + Math.ceil(Math.random() * 9999999);
      fs.writeFileSync(file, 'ls <%= options %> /');
      session.executeScript(file, {options: '-all'}, function() {
        fs.unlinkSync(file);
        done();
      });
    });

    test('with ejs options', function(done) {
      var session = new Session('host', {username: 'root', password: 'kuma'}, {ejs: {
        open: '{{',
        close: '}}'
      }});
      session.execute = function(shellCommand, callback) {
        assert.equal(shellCommand, 'ls -all /');
        callback();
      };
      var file = '/tmp/' + Math.ceil(Math.random() * 9999999);
      fs.writeFileSync(file, 'ls {{= options }} /');
      session.executeScript(file, {options: '-all'}, function() {
        fs.unlinkSync(file);
        done();
      });
    });
  });
});