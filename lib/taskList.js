var EventEmitter = require('events').EventEmitter;
var util = require('util');
var Session = require('./session');
var handlebars = require('handlebars');
var colors = require('colors');

function TaskList(name, options) {
  if(!(this instanceof TaskList)) {
    return new TaskList(name, options);
  }
  this._name = name;
  this._options = options || {};

  this._pretty = (this._options.pretty === false)? false: true;
  this._ignoreErrors = this._options.ignoreErrors;
  this._taskQueue = [];

  //used as a global variable used by all the tasks for each session
  this._vars = {};

  //used by all the tasks and sessions;
  this._globalVars = {}; 

  this._dependingTasks = [];
}

util.inherits(TaskList, EventEmitter);

TaskList.prototype.run = function(sessions, options, callback) {
  var self = this;
  
  if(!sessions) {
    throw new Error('first param should be either a session or a list of sessions');
  } else if(!(sessions instanceof Array)) {
    sessions = [sessions];
  }

  if(typeof(options) == 'function') {
    callback = options;
    options = {};
  }
  options = options || {};
  var summeryMap = {};
  var completed = 0;

  self.log('info', '\nStarted TaskList: ' + this._name);
  Array.prototype.forEach.call(sessions, function(session) {
    self._runTaskQueue(session, function(err, history) {
      summeryMap[session._host] = {error: err, history: history};

      if(++completed == sessions.length) {
        self.log('info', 'Completed TaskList: ' + self._name);
        if(callback) callback(summeryMap);
      }
    });
  });
};

TaskList.prototype.concat = function(taskLists, name, options) {
  if(typeof(name) == 'object') {
    options = name;
    name = null;
  }

  name = name || this._name + '+';
  options = options || this._options;
  var newTaskList = new TaskList(name, options);

  //merge content of _taskQueue of all taskLists into the new one
  var actionQueueList = taskLists.map(function(taskList) { return taskList._taskQueue; });
  actionQueueList.unshift(this._taskQueue);
  newTaskList._taskQueue = newTaskList._taskQueue.concat.apply(newTaskList._taskQueue, actionQueueList);

  return newTaskList;
};

TaskList.prototype._runTaskQueue = function(session, callback) {
  var self = this;
  var cnt = 0;
  var taskHistory = [];
  
  runTask();

  function runTask() {
    var task = self._taskQueue[cnt++];
    if(task) {
      self.emit('started', task.id);
      self.log('log', util.format('[%s] %s', session._host, task.id));
      var options = self._evaluateOptions(task.options, session);
      TaskList._registeredTasks[task.type](session, options, function(err) {
        if(err) {
          taskHistory.push({
            task: task.id,
            status: 'FAILED',
            error: err.message
          });
          self.emit('failed', err, task.id);
          self.log('error', util.format('[%s] %s: FAILED\n\t%s', session._host, task.id, err.message.replace(/\n/g, '\n\t')));

          if(self._ignoreErrors) {
            runTask();
          } else {
            callback(err, taskHistory);
          }
        } else {
          taskHistory.push({
            task: task.id,
            status: 'SUCCESS'
          })
          self.log('log', util.format('[%s] %s: SUCCESS', session._host, task.id));
          self.emit('success', task.id);
          runTask();
        }
      }, function(stdout, stderr) {
        var vars = self._getVarsForSession(session);
        if(task.varsMapper) {
          task.varsMapper.call(vars, stdout, stderr, self._globalVars);
        }
      });
    } else {
      callback(null, taskHistory);
    }
  }
};

TaskList.prototype._getVarsForSession = function(session) {
  if(!this._vars[session._host]) {
    this._vars[session._host] = {};
  }

  return this._vars[session._host];
};

TaskList.prototype._evaluateOptions = function(options, session) {
  var self = this;

  if(options instanceof Array) {
    for(var lc=0; lc<options.length; lc++) {
      self._evaluateOptions(options[lc], session);
    }
    return options;
  } else if(typeof(options) == 'object') {
    for(var key in options) {
      var value = options[key];

      if(typeof(value) == 'function') {
        var vars = self._getVarsForSession(session);
        options[key] = value.call(vars, self._globalVars);
      } else if(value == null) {
        options[key] = value;
      } else if(typeof(value) == 'string') {
        //add ejs support
        var vars = self._getVarsForSession(session);
        options[key] = handlebars.compile(value)(vars);
      } else {
        options[key] = self._evaluateOptions(value, session);
      }
    }
    return options;
  } else {
    return options;
  }
};

TaskList.prototype.log = function(type, message) {
  if(this._pretty) {
    if(type == 'info') {
      message = message.bold.blue;
    } else if(type == 'error') {
      message = message.bold.red;
    } else {
      message = message.cyan;
    }

    console[type](message);
  }
};

TaskList.prototype.depends = function(taskList) {
  this._dependingTasks.push(taskList);
};

TaskList._registeredTasks = {};

TaskList.registerTask = function(name, callback) {
  TaskList._registeredTasks[name] = callback;
  TaskList.prototype[name] = function(id, options, varsMapper) {
    this._taskQueue.push({
      type: name, 
      id: id,
      options: options,
      varsMapper: varsMapper
    });
  };
};

module.exports = TaskList;
