var hitler = require('./');

var taskList = hitler.taskList('Setup Stud');
taskList.copy("Sending Readme", {src: 'README.md', dest: '~/README.md'});

var session = hitler.session('192.241.170.33', {username: 'root', password: 'nmqatitqzinr'});

taskList.run(session);