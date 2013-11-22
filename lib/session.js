var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var util = require('util');
var helpers = require('./helpers');
var fs = require('fs');
var ejs = require('ejs');
var path = require('path');
var debug = require('debug');

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

Session.prototype.setTimeout = function(timeoutMillis) {
  this._debug('set timeout: %d', timeoutMillis);
  this._timeout = timeoutMillis;
};

Session.prototype.copy = function(src, dest, vars, options, callback) {
  if(typeof(options) == 'function') {
    callback = options;
    options = {};
  }
  options = options || {};
  callback = callback || function() {}

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
    copyFile = tmpFile = '/tmp/' + helpers.randomId();
  }

  if(this._auth.pem) {
    pemFile = '/tmp/' + helpers.randomId();
    fs.writeFile(pemFile, this._auth.pem, { mode: '0400' }, afterPemFileWritten);
  } else if(this._auth.password) {
    command = util.format('sshpass -p %s scp%s %s %s@%s:%s', 
      this._auth.password, self._sshOptions, copyFile, this._auth.username, this._host, dest);
    startProcessing();
  } else {
    throw new Error('NO_PASSWORD_OR_PEM');
  }

  function afterPemFileWritten(err) {
    if(err) {
      callback(err);
    } else {
      command = util.format('scp%s -i %s %s %s@%s:%s', 
        self._sshOptions, pemFile, copyFile, self._auth.username, self._host, dest);
      startProcessing();  
    }
  }

  function startProcessing() {
    if(vars) {
      //do templating
      self._applyTemplate(src, vars, afterTemplateApplied)
    } else {
      self._doSpawn(command, options, afterCompleted);
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
      self._doSpawn(command, options, afterCompleted);
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

Session.prototype.execute = function(shellCommand, options, callback) {
  if(typeof(options) == 'function') {
    callback = options;
    options = {};
  }
  options = options || {};
  callback = callback || function() {}

  var self = this;
  var tmpScript = '/tmp/' + helpers.randomId();
  var command;
  var pemFile;

  this._debug('execute - command: %s', shellCommand);

  if(this._auth.pem) {
    pemFile = '/tmp/' + helpers.randomId();
    fs.writeFile(pemFile, this._auth.pem, { mode: '0400' }, afterPemFileWritten);
  } else if(this._auth.password) {
    command = util.format('sshpass -p %s ssh%s %s@%s "bash -s" < %s', 
      this._auth.password, self._sshOptions, this._auth.username, this._host, tmpScript);
    startProcessing();
  } else {
    throw new Error('NO_PASSWORD_OR_PEM');
  }

  function afterPemFileWritten(err) {
    if(err) {
      callback(err);
    } else {
      command = util.format('ssh%s -i %s %s@%s "bash -s" < %s', 
        self._sshOptions, pemFile, self._auth.username, self._host, tmpScript);
      startProcessing();
    }
  }

  function startProcessing() {
    fs.writeFile(tmpScript, shellCommand, function(err) {
      if(err) {
        callback(err);
      } else {
        self._doSpawn(command, options, afterCompleted);
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

    function sendCallback(err) {
      //unlink error should not throw any errors
      callback.apply(err, args);
    }
  }
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

Session.prototype._doSpawn = function(command, options, callback) {
  var self = this;
  var tmpScript = '/tmp/' + helpers.randomId();
  var logs = { stdout: "", stderr: ""};
  var bash;
  var time
  var timeoutHandler;

  this._debug('spawning command- %s', command);

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

    if(options.onStdout) {
      bash.stdout.on('data', options.onStdout);
    }

    if(options.onStderr) {
      bash.stderr.on('data', options.onStderr);
    }

    if(self._timeout) {
      timeoutHandler = setTimeout(onTimeout, self._timeout);
    }
  }

  function sendCallback(err, code, logs) {
    if(err) {
      self._debug('error: %s', err.message);
    } else {
      self._debug('spawn completed - code: %d - \n\tstdout: %s \t\tstderr', code, logs.stdout, logs.stderr);
    }

    if(callback) {
      callback(err, code, logs);
      callback = null;

      //cleanup
      bash.stdout.removeListener('data', onStdOut);
      bash.stderr.removeListener('data', onStdErr);

      if(options.onStdout) {
        bash.stdout.removeListener('data', options.onStdout);
      }
      if(options.onStderr) {
        bash.stderr.removeListener('data', options.onStderr);
      }

      bash.removeListener('error', sendCallback);
      bash.removeListener('close', onClose);


      //clenup tmpScript
      fs.unlink(tmpScript);
    }
  }

  function onClose(code) {
    if(timeoutHandler) {
      clearTimeout(timeoutHandler);
      timeoutHandler = null;
    }
    sendCallback(null, code, logs);
  }

  function onStdOut(data) {
    logs.stdout += data.toString();
  }

  function onStdErr(data) {
    logs.stderr += data.toString();
  }

  function onTimeout() {
    var killScript = path.resolve(__dirname, '../scripts/kill.sh');
    sendCallback(new Error('TIMEOUT'));
    exec('sh ' + killScript + ' ' + bash.pid, function(err) {
      if(err) {
        console.error('kiiling on timeout failed');
      }
    });
    timeoutHandler = null;
  }
}

module.exports = Session