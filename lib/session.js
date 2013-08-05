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

Session.prototype.copy = function(src, dest, vars, callback) {
  var self = this;
  var command;
  var copyFile = src;
  var tmpFile;

  if(typeof(vars) == 'function') {
    callback = vars;
    vars = null;
  }

  //lets do templating
  if(vars) {
    copyFile = tmpFile = '/tmp/' + helpers.randomId();
  }

  if(this._auth.pem) {
    command = util.format('scp -i %s %s %s@%s:%s', 
      this._auth.pem, copyFile, this._auth.username, this._host, dest);
  } else if(this._auth.password) {
    command = util.format('sshpass -p %s scp %s %s@%s:%s', 
      this._auth.password, copyFile, this._auth.username, this._host, dest);
  } else {
    throw new Error('NO_PASSWORD_OR_PEM');
  }

  if(vars) {
    //do templating
    this._applyTemplate(src, vars, afterTemplateApplied)
  } else {
    this._doSpawn(command, afterCompleted);
  }

  function afterTemplateApplied(err, content) {
    if(err) {
      callback(err);
    } else {
      fs.writeFile(tmpFile, content, afterFileWrittern);
    }
  }

  function afterFileWrittern(err) {
    if(err) {
      callback(err);
    } else {
      self._doSpawn(command, afterCompleted);
    }
  }

  function afterCompleted() {
    var args = arguments;
    if(tmpFile) {
      fs.unlink(tmpFile, sendCallback);
    } else {
      sendCallback();
    }

    function sendCallback() {
      //unlink error should not throw any errors
      callback.apply(null, args);
    }
  }
};

Session.prototype.execute = function(shellCommand, callback) {
  var self = this;
  var tmpScript = '/tmp/' + helpers.randomId();
  var command;

  if(this._auth.pem) {
    command = util.format('ssh -i %s %s@%s "bash -s" < %s', 
      this._auth.pem, this._auth.username, this._host, tmpScript);
  } else if(this._auth.password) {
    command = util.format('sshpass -p %s ssh %s@%s "bash -s" < %s', 
      this._auth.password, this._auth.username, this._host, tmpScript);
  } else {
    throw new Error('NO_PASSWORD_OR_PEM');
  }

  fs.writeFile(tmpScript, shellCommand, function(err) {
    if(err) {
      callback(err);
    } else {
      self._doSpawn(command, afterCompleted);
    }
  });


  function afterCompleted() {
    var args = arguments;
    fs.unlink(tmpScript, function() {
      //unlink error should not throw any errors
      callback.apply(null, args);
    });
  }
};

Session.prototype.executeScript = function(scriptFile, vars, callback) {
  var self = this;
  if(typeof(vars) == 'function') {
    callback = vars;
    vars = null
  }

  this._applyTemplate(scriptFile, vars, function(err, content) {
    if(err) {
      callback(err);
    } else {
      self.execute(content, callback);
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
}

module.exports = Session;