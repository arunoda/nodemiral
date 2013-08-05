var EventEmitter = require('events').EventEmitter;
var registeredTasks = {};
var util = require('util');

function TaskList(name, options) {
  if(!(this instanceof TaskList)) {
    return new TaskList(name, options);
  }
  this._name = name;
  this._options = options;

  this._actionQueue = [];
}

TaskList.prototype.run = function() {
  var self = this;
  var sessions;
  var callback;
  if(arguments[0].constructor === Array) {
    sessions = arguments[0];
    callback = arguments[1];
  } else {
    sessions = arguments;
    if(typeof(arguments[arguments.length -1]) == 'function') {
      callback = Array.prototype.pop.call(arguments);
    }
  }

  console.log('\nStarted TaskList: ' + this._name);
  Array.prototype.forEach.call(sessions, function(session) {
    self._runActionQueue(session, afterComplete);
  });

  var completed = 0;
  var errors = []; 
  function afterComplete(err) {
    if(err) {
      errors.push(err);
    }

    if(++completed == sessions.length) {
      console.log('Completed TaskList: ' + self._name);
      if(callback) callback(errors);
    }
  }
};

TaskList.prototype._runActionQueue = function(session, callback) {
  var self = this;
  var cnt = 0;
  runAction();

  function runAction() {
    var action = self._actionQueue[cnt++];
    if(action) {
      action.events.emit('started');
      console.log(util.format('[%s] %s', session._host, action.message));
      registeredTasks[action.type](session, action.options, function(err) {
        if(err) {
          action.events.emit('failed', err);
          console.log(util.format('[%s] %s: FAILED\n\t%s', session._host, action.message, err.message.replace(/\n/g, '\n\t')));
          callback(err);
        } else {
          console.log(util.format('[%s] %s: COMPLETED', session._host, action.message));
          action.events.emit('completed');
          runAction();
        }
      });
    } else {
      callback();
    }
  }
};

TaskList.registerTask = function(name, callback) {
  registeredTasks[name] = callback;
  TaskList.prototype[name] = function(message, options) {
    var events = new EventEmitter();
    this._actionQueue.push({
      type: name, 
      events: events,
      message: message,
      options: options
    });
    return events;
  };
};

module.exports = TaskList;