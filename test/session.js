var Session = require('../lib/session');
var helpers = require('../lib/helpers');
var assert = require('assert');
var fs = require('fs');

suite('Session', function() {
  suite('.copy()', function() {
    test('with password', function(done) {
      var session = new Session('host', {username: 'root', password: 'kuma'});
      session._doSpawn = function(command, options, callback) {
        assert.equal(command, 'sshpass -p kuma scp ./src root@host:~/dest');
        callback();
      };
      session.copy('./src', '~/dest', done);
    });

    test('with pem', function(done) {
      var session = new Session('host', {username: 'root', pem: 'pem-content'});
      var pemFile;
      session._doSpawn = function(command, options, callback) {
        var matched = command.match(/scp -i ([\w\/]*) .\/src root@host:~\/dest/);
        assert.ok(matched);
        pemFile = matched[1];
        var pemFileContent = fs.readFileSync(pemFile, 'utf8');
        assert.equal(pemFileContent, 'pem-content');
        callback();
      };
      session.copy('./src', '~/dest', function() {
        assert.equal(fs.existsSync(pemFile), false);
        done();
      });
    });

    test('no pem or password', function(done) {
      var session = new Session('host', {username: 'root'});
      assert.throws(function() {
        session.copy('./src', '~/dest', done);
      });
      done();
    });

    test('with vars', function(done) {

      var tmpFile = '/tmp/' + helpers.randomId();
      fs.writeFileSync(tmpFile, 'name: <%=name %>');

      var session = new Session('host', {username: 'root', password: 'kuma'});
      session._doSpawn = function(command, options, callback) {
        var matched = command.match(/sshpass -p kuma scp ([\w\/]*) root@host:~\/dest/);
        assert.ok(matched);

        var compiledFile = matched[1];
        assert.ok(compiledFile);
        var compiledContent = fs.readFileSync(compiledFile, {encoding: 'utf8'});
        assert.equal(compiledContent, 'name: arunoda');

        callback();
      };
      session.copy(tmpFile, '~/dest', {name: 'arunoda'}, done);
    });

    test('with ssh options', function(done) {

      var tmpFile = '/tmp/' + helpers.randomId();
      fs.writeFileSync(tmpFile, 'name: <%=name %>');

      var session = new Session('host', {username: 'root', password: 'kuma'}, { ssh: { foo: 'bar' }});
      session._doSpawn = function(command, options, callback) {
        fs.unlinkSync(tmpFile);
        var matched = command.match(/sshpass -p kuma scp -o foo=bar ([\w\/]*) root@host:~\/dest/);
        assert.ok(matched);
        callback();
      };
      session.copy(tmpFile, '~/dest', {name: 'arunoda'}, done);
    });
  });

  suite('.execute()', function() {
    test('with password', function(done) {
      var session = new Session('host', {username: 'root', password: 'kuma'});
      session._doSpawn = function(command, options, callback) {
        var matched = command.match(/sshpass -p kuma ssh root@host "bash -s" < (.*)/);
        var scriptLocation = matched[1];
        assert.ok(matched);
        assert.ok(command.indexOf(scriptLocation) > 0);
        var fileContent = fs.readFileSync(scriptLocation, {encoding: 'utf8'});
        assert.equal(fileContent, 'ls /');
        callback();
      };
      session.execute('ls /', done);
    });

    test('with pem', function(done) {
      var session = new Session('host', {username: 'root', pem: 'the-pem-content'});
      var pemFile;
      var scriptLocation;
      session._doSpawn = function(command, options, callback) {
        var matched = command.match(/ssh -i ([\w\/]*) root@host "bash -s" < (.*)/);
        assert.ok(matched);

        pemFile = matched[1];
        scriptLocation = matched[2];
      
        var fileContent = fs.readFileSync(scriptLocation, {encoding: 'utf8'});
        assert.equal(fileContent, 'ls /');

        var pemFileContent = fs.readFileSync(pemFile, 'utf8');
        assert.equal(pemFileContent, 'the-pem-content');

        callback();
      };
      session.execute('ls /', function() {
        assert.equal(fs.existsSync(pemFile), false);
        assert.equal(fs.existsSync(scriptLocation), false);
        done();
      });
    });

    test('no password or pem', function(done) {
      var session = new Session('host', {username: 'root'});
      assert.throws(function() {
        session.execute('ls /', done);
      });
      done();
    });

    test('with sshOptions', function(done) {
      var session = new Session('host', {username: 'root', password: 'kuma'}, { ssh: { foo: 'bar' }});
      session._doSpawn = function(command, options, callback) {
        var matched = command.match(/sshpass -p kuma ssh -o foo=bar root@host "bash -s" < (.*)/);
        assert.ok(matched);
        callback();
      };
      session.execute('ls /', done);
    });
  });

  suite('.executeScript', function() {
    test('file exists', function(done) {
      var session = new Session('host', {username: 'root', password: 'kuma'});
      session.execute = function(shellCommand, options, callback) {
        assert.equal(shellCommand, 'ls -all /');
        callback();
      };
      var file = '/tmp/' + Math.ceil(Math.random() * 9999999);
      fs.writeFileSync(file, 'ls -all /');
      session.executeScript(file, {}, function() {
        fs.unlinkSync(file);
        done();
      });
    });

    test('file not exists', function(done) {
      var session = new Session('host', {username: 'root', password: 'kuma'});
      session.execute = function(shellCommand, options, callback) {
        assert.equal(shellCommand, 'ls -all /');
        callback();
      };

      session.executeScript('/tmp/ssdcs', {}, function(err) {
        assert.ok(err);
        done();
      });
    });

    test('with ejs', function(done) {
      var session = new Session('host', {username: 'root', password: 'kuma'});
      session.execute = function(shellCommand, options, callback) {
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
      session.execute = function(shellCommand, options, callback) {
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