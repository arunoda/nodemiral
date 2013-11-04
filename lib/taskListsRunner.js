var colors = require('colors');

function TaskListRunner(options) {
  if(!(this instanceof TaskListRunner)) {
    return new TaskListRunner(options);
  }

  this._options = options || {};
  this._items = [];

  this._vars = {};
  this._globalVars = {};
}

TaskListRunner.prototype.add = function(taskList, sessions) {
  var self = this;
  if(!sessions) {
    throw new Error('no session provided');
  } else if(!sessions instanceof Array) {
    sessions = [sessions]
  }

  //adding dependencies
  taskList._dependingTasks.forEach(function(tl) {
    self.add(tl, sessions);
  });

  //setting up vars
  taskList._vars = this._vars;
  taskList._globalVars = this._globalVars;

  this._items.push({
    taskList: taskList, 
    sessions: sessions
  });
};

TaskListRunner.prototype.run = function(options) {
  var self = this;
  var count = 0;

  runTaskList();
  function runTaskList() {
    var item = self._items[count++];
    if(item) {
      item.taskList.run(item.sessions, options, function(summeryMap) {
        var erroredSummeryMap = self._pickErrored(summeryMap);
        if(erroredSummeryMap) {
          self._printErroredSummeryMap(erroredSummeryMap);
        } else {
          runTaskList();
        }
      });
    }
  }
};

TaskListRunner.prototype._pickErrored = function(summeryMap) {
  var erroredSummeryMap = {};
  var errorFound = false;

  for(var host in summeryMap) {
    if(summeryMap[host].error) {
      erroredSummeryMap[host] = summeryMap[host];
      errorFound = true;
    }
  }

  if(errorFound) {
    return erroredSummeryMap;
  } else {
    return null;
  }
};

TaskListRunner.prototype._printErroredSummeryMap = function(summeryMap) {
  var hosts = Object.keys(summeryMap);
  var message = ">> ERROR(S) in: " + hosts.join(', ');
  console.error(message.bold.red);
};

module.exports = TaskListRunner;