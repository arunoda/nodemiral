var Session = require('./session');
var TaskList = require('./taskList');

var hitler = module.exports;
hitler.session = Session;
hitler.taskList = TaskList;
hitler.registerTask = TaskList.registerTask;

//load initial core tasks
require('./coreTasks')(hitler);