var fs = require('fs');

module.exports = function(hitler) {
  hitler.tasks.script = function(hitler, options, callback) {
    fs.readFile(options.script, {encoding: 'utf8'}, function(err, content) {
      if(err) {
        callback(err);
      } else {
        callback(null, content);
      }
    });
  }
}

// function generateOutput(script, eof, outFile) {
//     var shellScript = "" +
//       "SCRIPT=$(cat <<" + eof + 
//       content + 
//       eof + 
//       ")" + 
//       "echo $SCRIPT >" + script + 
//       "sh " + script;

//     return shellScript;
// }
