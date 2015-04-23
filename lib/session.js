var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var util = require('util');
var helpers = require('./helpers');
var fs = require('fs');
var ejs = require('ejs');
var path = require('path');
var debug = require('debug');
var SSHClient = require('./ssh');
var SshClient = require('ssh2');

function Session(host, auth, options) {
  if(!(this instanceof Session)) {
    return new Session(host, auth, options);
  }

  var self = this;
  this._host = host;
  this._auth = auth;
  this._options = options || {};

  this._tasks = [];
  this._callbacks = [];

  this._timeout = this._options.timeout;

  this._sshOptions = '';
  if (!this._options.ssh) this._options.ssh = {};
  Object.keys(this._options.ssh).forEach(function (key) {
    self._sshOptions += util.format(' -o %s=%s',  key, self._options.ssh[key]);
  });

  this._debug = debug('nodemiral:sess:' + host);
}

Session.prototype._getSshConnInfo = function() {
  var connInfo = {
    host: this._host,
    username: this._auth.username
  };

  if(this._auth.pem) {
    connInfo.privateKey = this._auth.pem;
  } else {
    connInfo.password = this._auth.password;
  }

  return connInfo;
};

Session.prototype.copy = function(src, dest, vars, options, callback) {
  if(typeof(options) == 'function') {
    callback = options;
    options = {};
  }
  options = options || {};
  callback = callback || function() {};

  var self = this;
  var command;
  var copyFile = src;
  var tmpFile;
  var pemFile;

  this._debug('copy file - src: %s, dest: %s, vars: %j', src, dest, vars);

  if(typeof(vars) == 'function') {
    callback = vars;
    vars = null;
  }

  //lets do templating
  if(vars) {
    self._applyTemplate(src, vars, function(err, content) {
      if(err) {
        callback(err);
      } else {
        startProcessing(content, "putContent");
      }
    });
  } else {
    startProcessing(copyFile, "putFile");
  }

  function startProcessing(srcFile, methodName) {
    var sshConnInfo = self._getSshConnInfo();
    var client = new SSHClient();
    client.connect(sshConnInfo);

    client[methodName](srcFile, dest, function(err) {
      client.close();
      if(err) {
        callback(err);
      } else {
        callback(null, 0, {});
      }
    });
  }
};

Session.prototype.execute = function(shellCommand, options, callback) {
  if(typeof(options) == 'function') {
    callback = options;
    options = {};
  }
  options = options || {};
  callback = callback || function() {};

  var sshConnInfo = this._getSshConnInfo();
  var client = new SSHClient();
  client.connect(sshConnInfo);
  client.execute(shellCommand, function(err, context) {
    client.close();
    if(err) {
      callback(err);
    } else {
      if(options.onStdout) {
        callback(context.stdout);
      }

      if(options.onStderr) {
        callback(context.stderr);
      }

      callback(null, context.code, context);
    }
  });
};

Session.prototype.executeScript = function(scriptFile, vars, options, callback) {
  if(typeof(options) == 'function') {
    callback = options;
    options = {};
  }
  options = options || {};
  callback = callback || function() {};

  var self = this;

  this._applyTemplate(scriptFile, vars, function(err, content) {
    if(err) {
      callback(err);
    } else {
      self.execute(content, options, callback);
    }
  });
};

Session.prototype._applyTemplate = function(file, vars, callback) {
  var self = this;
  fs.readFile(file, {encoding: 'utf8'}, function(err, content) {
    if(err) {
      callback(err);
    } else {
      if(vars) {
        var ejsOptions = self._options.ejs || {};
        var content = ejs.compile(content, ejsOptions)(vars);
      }
      callback(null, content);
    } 
  });
};

module.exports = Session;