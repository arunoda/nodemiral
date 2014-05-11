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
    throw new Error('No session provided');
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
      item.taskList.run(item.sessions, options, function(summaryMap) {
        var erroredSummaryMap = self._pickErrored(summaryMap);
        if(erroredSummaryMap) {
          self._printErroredSummaryMap(erroredSummaryMap);
        } else {
          runTaskList();
        }
      });
    }
  }
};

TaskListRunner.prototype._pickErrored = function(summaryMap) {
  var erroredSummaryMap = {};
  var errorFound = false;

  for(var host in summaryMap) {
    if(summaryMap[host].error) {
      erroredSummaryMap[host] = summaryMap[host];
      errorFound = true;
    }
  }

  if(errorFound) {
    return erroredSummaryMap;
  } else {
    return null;
  }
};

TaskListRunner.prototype._printErroredSummaryMap = function(summaryMap) {
  var hosts = Object.keys(summaryMap);
  var message = "\u2718 ERROR(S) in: " + hosts.join(', ');
  console.error(message.bold.red);
};

module.exports = TaskListRunner;