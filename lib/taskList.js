var EventEmitter = require('events').EventEmitter;
var util = require('util');
var Session = require('./session');

function TaskList(name, options) {
  if(!(this instanceof TaskList)) {
    return new TaskList(name, options);
  }
  this._name = name;
  this._options = options || {};

  this._pretty = (this._options.pretty === false)? false: true;
  this._ignoreErrors = this._options.ignoreErrors;
  this._actionQueue = [];
}

util.inherits(TaskList, EventEmitter);

TaskList.prototype.run = function(sessions, options, callback) {
  var self = this;

  if(sessions instanceof Session) {
    sessions = [sessions];
  } else if(!(sessions instanceof Array)) {
    throw new Error('first param should be either a session or a list of sessions');
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
    self._runActionQueue(session, function(err, summery) {
      summeryMap[session._host] = summery;

      if(++completed == sessions.length) {
        self.log('info', 'Completed TaskList: ' + self._name);
        if(callback) callback(err, summeryMap);
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

  //merge content of _actionQueue of all taskLists into the new one
  var actionQueueList = taskLists.map(function(taskList) { return taskList._actionQueue; });
  actionQueueList.unshift(this._actionQueue);
  newTaskList._actionQueue = newTaskList._actionQueue.concat.apply(newTaskList._actionQueue, actionQueueList);

  return newTaskList;
};

TaskList.prototype._runActionQueue = function(session, callback) {
  var self = this;
  var cnt = 0;
  var summery = [];
  
  runAction();

  function runAction() {
    var action = self._actionQueue[cnt++];
    if(action) {
      self.emit('started', action.id);
      self.log('info', util.format('[%s] %s', session._host, action.id));
      TaskList._registeredTasks[action.type](session, action.options, function(err) {
        if(err) {
          summery.push({
            action: action.id,
            status: 'FAILED',
            error: err.message
          });
          self.emit('failed', err, action.id);
          self.log('info', util.format('[%s] %s: FAILED\n\t%s', session._host, action.id, err.message.replace(/\n/g, '\n\t')));

          if(self._ignoreErrors) {
            runAction();
          } else {
            callback(err, summery);
          }
        } else {
          summery.push({
            action: action.id,
            status: 'SUCCESS'
          })
          self.log('info', util.format('[%s] %s: SUCCESS', session._host, action.id));
          self.emit('success', action.id);
          runAction();
        }
      });
    } else {
      callback(null, summery);
    }
  }
};

TaskList.prototype.log = function(type, message) {
  if(this._pretty) {
    console[type](message);
  }
};

TaskList._registeredTasks = {};

TaskList.registerTask = function(name, callback) {
  TaskList._registeredTasks[name] = callback;
  TaskList.prototype[name] = function(id, options) {
    this._actionQueue.push({
      type: name, 
      id: id,
      options: options
    });
  };
};

module.exports = TaskList;