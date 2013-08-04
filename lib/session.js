var spawn = require('child_process').spawn;
var helpers = require('./helpers');

function Session(hitler, host, auth, options) {
  this._hitler = hitler;
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

Session.prototype.run = function(endCallback) {
  var self = this;

  this._prepareFinalScript(function(err, finalScript) {
    if(err) {
      endCallback(err);
    } else {
      var sshAddress = self._auth.username + '@' + self._auth.host;
      var ssh = spawn("sshpass", ["-p", self._auth.password, "ssh" , sshAddress, finalScript]);
      ssh.stdout.on('data', function(data) {
        console.log('stdout: ' + data);
      });

      ssh.stderr.on('data', function(data) {
        console.log('stderr: ' + data)
      });

      ssh.on('error', function(err) {
        if(endCallback) {
          endCallback(err);
          endCallback = null;
        }
      });

      ssh.on('close', function(code) {
        if(endCallback){
          endCallback(null);
          endCallback = null;
        }
      });
    }
  });
};

Session.prototype._prepareFinalScript = function(callback) {
  var self = this;
  var finalScript = "";

  doPrepare();
  function doPrepare() {
    var task = this._tasks.shift();
    if(task) {
      self._hitler.tasks[task.type](task.options, afterCompleted);
    } else {
      self._tasks = [];
      callback(null, finalScript);
    }

    function afterCompleted(err, scriptContent) {
      if(err) {
        callback(err);
      } else {
        var taskId = self._hitler.helpers.randomId();
        finalScript += "\n" +
          '__hitler_task_start' + taskId + "\n" + 
          scriptContent +
          '__hitler_task_end';

        self._callbacks[taskId] = task.callback;
        doPrepare();
      }
    }
  }
};

module.exports = Session;
