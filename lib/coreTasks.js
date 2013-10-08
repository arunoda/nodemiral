module.exports = function(hitler) {
  hitler.registerTask('copy', copy);
  hitler.registerTask('execute', execute);
  hitler.registerTask('executeScript', executeScript);
}

function copy(session, options, callback) {
  if(options.vars) {
    session.copy(options.src, options.dest, options.vars, sendCallback(callback));
  } else {
    session.copy(options.src, options.dest, sendCallback(callback));
  }
}

function execute(session, options, callback) {
  session.execute(options.command, sendCallback(callback));
}

function executeScript(session, options, callback) {
  session.executeScript(options.script, options.vars || {}, sendCallback(callback));
}

function sendCallback(callback) {
  return function(err, code, logs) {
    if (err) {
      callback(err);
    } else if(code !== 0) {
      
      var errorMessage = '\n----------------------------------------------------------------------';
      errorMessage += "STDERR:\n";
      errorMessage += logs.stderr;
      errorMessage += '\n----------------------------------------------------------------------';
      errorMessage += "\nSTDOUT:\n";
      errorMessage += logs.stdout;
      errorMessage += '\n----------------------------------------------------------------------';

      callback(new Error(errorMessage));
    } else {
      callback();
    }
  };
}