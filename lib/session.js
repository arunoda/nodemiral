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
  var pemFile;

  if(typeof(vars) == 'function') {
    callback = vars;
    vars = null;
  }

  //lets do templating
  if(vars) {
    copyFile = tmpFile = '/tmp/' + helpers.randomId();
  }

  if(this._auth.pem) {
    pemFile = '/tmp/' + helpers.randomId();
    fs.writeFile(pemFile, this._auth.pem, afterPemFileWritten);
  } else if(this._auth.password) {
    command = util.format('sshpass -p %s scp %s %s@%s:%s', 
      this._auth.password, copyFile, this._auth.username, this._host, dest);
    startProcessing();
  } else {
    throw new Error('NO_PASSWORD_OR_PEM');
  }

  function afterPemFileWritten(err) {
    if(err) {
      callback(err);
    } else {
      command = util.format('scp -i %s %s %s@%s:%s', 
        pemFile, copyFile, self._auth.username, self._host, dest);
      startProcessing();  
    }
  }

  function startProcessing() {
    if(vars) {
      //do templating
      self._applyTemplate(src, vars, afterTemplateApplied)
    } else {
      self._doSpawn(command, afterCompleted);
    }
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
    deletePemFile();

    function deletePemFile() {
      if(pemFile) {
        fs.unlink(pemFile, deleteTmpFile);
      } else {
        deleteTmpFile();
      }
    }
    function deleteTmpFile() {
      if(tmpFile) {
        fs.unlink(tmpFile, sendCallback);
      } else {
        sendCallback();
      }
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
  var pemFile;

  if(this._auth.pem) {
    pemFile = '/tmp/' + helpers.randomId();
    fs.writeFile(pemFile, this._auth.pem, { mode: '0600' }, afterPemFileWritten);
  } else if(this._auth.password) {
    command = util.format('sshpass -p %s ssh %s@%s "bash -s" < %s', 
      this._auth.password, this._auth.username, this._host, tmpScript);
    startProcessing();
  } else {
    throw new Error('NO_PASSWORD_OR_PEM');
  }

  function afterPemFileWritten(err) {
    if(err) {
      callback(err);
    } else {
      command = util.format('ssh -i %s %s@%s "bash -s" < %s', 
        pemFile, self._auth.username, self._host, tmpScript);
      startProcessing();
    }
  }

  function startProcessing() {
    fs.writeFile(tmpScript, shellCommand, function(err) {
      if(err) {
        callback(err);
      } else {
        self._doSpawn(command, afterCompleted);
      }
    });
  }

  function afterCompleted() {
    var args = arguments;

    if(pemFile) {
      fs.unlink(pemFile, removeTmpScript);
    } else {
      removeTmpScript();
    }

    function removeTmpScript() {
      fs.unlink(tmpScript, sendCallback);
    }

    function sendCallback() {
      //unlink error should not throw any errors
      callback.apply(null, args);
    }
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