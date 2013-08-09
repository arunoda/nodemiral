var Session = require('./session');
var TaskList = require('./taskList');

var nodemiral = module.exports;
nodemiral.session = Session;
nodemiral.taskList = TaskList;
nodemiral.registerTask = TaskList.registerTask;

//load initial core tasks
require('./coreTasks')(nodemiral);