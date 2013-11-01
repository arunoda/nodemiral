var fs = require('fs');
var nodemiral = require('../../');

var sshPrivateKey = fs.readFileSync(process.env.HOME + '/.ssh/id_rsa', 'utf8');
var session = nodemiral.session('162.243.77.68', {username: 'root', pem: sshPrivateKey});
var taskList = nodemiral.taskList('Getting and Printing `uname -a`');

taskList.execute('invoke uname', {
  command: 'uname -a'
}, function(stdout, stderr) {
  this.uname = stdout;
});

taskList.print('printing uname', {
  message: "\t Uname is: {{uname}}"
});

taskList.run(session);