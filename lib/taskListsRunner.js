function TaskListRunner(options) {
  if(!(this instanceof TaskListRunner)) {
    return new TaskListRunner(options);
  }

  this._options = options || {};
  this._items = [];
}

TaskListRunner.prototype.add = function(taskList, sessions) {
  if(!sessions) {
    throw new Error('no session provided');
  } else if(!sessions instanceof Array) {
    sessions = [sessions]
  }

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
  for(var host in summeryMap) {
    console.error('>> ERROR in :' + host);
    console.error('--------------------------------------------------------------');
    console.error(summeryMap[host].error + '\n');
  }
};

module.exports = TaskListRunner;