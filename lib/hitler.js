var Session = require('./session');
var fs = require('fs');
var path = require('path');

var hitler = module.exports;

hitler.tasks = {};
hitler.session = function session(host, auth, options) {
  return new Session(hitler, host, auth, options);  
};
hitler.helpers = require('./helpers');

//do task registration
var tasksPath = path.resolve(__dirname, 'tasks');
var files = fs.readdirSync(tasksPath);
files.forEach(function(file) {
  if(file.match(/\.js$/)) {
    require(path.resolve(tasksPath, file))(hitler);
  }
});
