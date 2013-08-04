var hitler = require('../');
var path = require('path');
var session = hitler.session('193.541.170.33', {username: 'root', password: 'ndfdf3d3ritqzinr'});

session.execute('cat script.sh', printLog);

var script = path.resolve(__dirname, 'script.sh');
session.executeScript(script, printLog);

session.copy(script, '~/script.sh', printLog);

function printLog(err, code, logs) {
  console.log(logs.stdout);
}