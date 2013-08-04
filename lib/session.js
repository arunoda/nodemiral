var spawn = require('child_process').spawn;
var util = require('util');
var helpers = require('./helpers');
var fs = require('fs');
var ejs = require('ejs');

function Session(host, auth, options) {
  if(!(this instanceof Session)) {
    return new Session(host, auth, options);
  }

  this._host = host;
  this._auth = auth;
  this._options = options || {};

  this._tasks = [];
  this._callbacks = [];
}

Session.prototype.task = function(type, options, callback) {
  this._tasks.push({
    type: type, 
    options: options || {}, 
    callback: callback
  });
};

Session.prototype.copy = function(src, dest, callback) {
  var command;
  if(this._auth.pem) {
    command = util.format('scp -i %s %s %s@%s:%s', 
      this._auth.pem, src, this._auth.username, this._host, dest);
  } else if(this._auth.password) {
    command = util.format('sshpass -p %s scp %s %s@%s:%s', 
      this._auth.password, src, this._auth.username, this._host, dest);
  } else {
    throw new Error('NO_PASSWORD_OR_PEM');
  }

  this._doSpawn(command, callback);
};

Session.prototype.execute = function(shellCommand, callback) {
  var command;
  if(this._auth.pem) {
    command = util.format('ssh -i %s %s@%s %s', 
      this._auth.pem, this._auth.username, this._host, shellCommand);
  } else if(this._auth.password) {
    command = util.format('sshpass -p %s ssh %s@%s %s', 
      this._auth.password, this._auth.username, this._host, shellCommand);
  } else {
    throw new Error('NO_PASSWORD_OR_PEM');
  }

  this._doSpawn(command, callback);
};

Session.prototype.executeScript = function(scriptFile, vars, callback) {
  var self = this;
  if(typeof(vars) == 'function') {
    callback = vars;
    vars = null
  }

  fs.readFile(scriptFile, {encoding: 'utf8'}, function(err, content) {
    if(err) {
      callback(err);
    } else {
      if(vars) {
        var ejsOptions = self._options.ejs || {};
        var content = ejs.compile(content, ejsOptions)(vars);
      }
      self.execute(content, callback);
    } 
  });
};

Session.prototype._doSpawn = function(command, callback) {
  var tmpScript = '/tmp/' + helpers.randomId();
  var logs = { stdout: "", stderr: ""};
  var bash;

  fs.writeFile(tmpScript, command, function(err) {
    if(err) {
      callback(err);
    } else {
      executeTmpScript();
    }
  })

  function executeTmpScript() {
    bash = spawn('bash', [tmpScript]);
    
    bash.stdout.on('data', onStdOut);
    bash.stderr.on('data', onStdErr);
    bash.once('error', sendCallback);
    bash.once('close', onClose);
  }

  function sendCallback(err, code, logs) {
    if(callback) {
      callback(err, code, logs);
      callback = null;

      //cleanup
      bash.stdout.removeListener('data', onStdOut);
      bash.stderr.removeListener('data', onStdErr);
      bash.removeListener('error', sendCallback);
      bash.removeListener('close', onClose);
    }
  }

  function onClose(code) {
    sendCallback(null, code, logs);
  }

  function onStdOut(data) {
    logs.stdout += data.toString();
  }

  function onStdErr(data) {
    logs.stderr += data.toString();
  }
};

module.exports = Session;