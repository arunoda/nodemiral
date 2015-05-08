var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var util = require('util');
var helpers = require('./helpers');
var fs = require('fs');
var ejs = require('ejs');
var path = require('path');
var debug = require('debug');
var SSHClient = require('./ssh');
var SshClient = require('ssh2');
var _ = require('underscore');
var ProgressBar = require('progress');
var sshConfig = require('ssh-config');

function Session(host, auth, options) {
  if(!(this instanceof Session)) {
    return new Session(host, auth, options);
  }

  var self = this;
  this._host = host;
  this._auth = auth;
  this._options = options || {};
  this._keepAlive = !!this._options.keepAlive;

  this._tasks = [];
  this._callbacks = [];

  this._debug = debug('nodemiral:sess:' + host);

  // null means it's not set
  self._ssh_config = null;

  this._getSshConfigInfo(this._options.config, function (err, config) {
    if(!err) {
      self._ssh_config = config;
      return;
    } else if(self._options.config) {
      throw err;
    } else {
      self._ssh_config = {};
    }
  });
}

Session.prototype._getSshConfigInfo = function(file, callback) {
  var file = file || '~/.ssh/config';
  var host = this._host;

  fs.readFile(file, {encoding: 'utf8'}, function(err, content) {
    if(err) {
      return callback(err);
    }

    var connInfo = {};
    var config = sshConfig.parse(content);

    for(var i=0; i<config.length; ++i) {
      var conf = config[i];

      if(conf.Host === '*') {
        if(conf.HostName) {
          connInfo.host = connInfo.host || conf.HostName;
        }

        if(conf.User) {
          connInfo.username = connInfo.username || conf.User;
        }

        if(conf.IdentityFile) {
          connInfo.privateKey = connInfo.privateKey || conf.IdentityFile;
        }
      }

      if(conf.Host === host) {
        if(conf.HostName) {
          connInfo.host = conf.HostName;
        }

        if(conf.User) {
          connInfo.username = conf.User;
        }

        if(conf.IdentityFile) {
          connInfo.privateKey = conf.IdentityFile;
        }
      }
    }

    callback(null, connInfo);
  });
};

Session.prototype._getSshConnInfo = function() {
  var connInfo = {
    host: this._host,
    readyTimeout: 60000
  };

  _.extend(connInfo, this._ssh_config);

  if(this._auth.username) {
    connInfo.username = this._auth.username;
  }

  if(this._auth.pem) {
    connInfo.privateKey = this._auth.pem;
  } else if(this._auth.password) {
    connInfo.password = this._auth.password;
  }

  _.extend(connInfo, this._options.ssh);
  return connInfo;
};

Session.prototype._withSshClient = function(callback) {
  var self = this;

  if(this._ssh_config === null) {
    setImmediate(function () {
      self._withSshClient(callback);
    });

    return;
  }

  if(this._keepAlive) {
    if(!this._keepAliveClient) {
      this._keepAliveClient = new SSHClient();
      this._keepAliveClient.connect(this._getSshConnInfo());
    }

    callback(this._keepAliveClient, function() {});
  } else {
    var client = new SSHClient();
    client.connect(this._getSshConnInfo());
    callback(client, done);

    function done() {
      client.close();
    }
  }
};

Session.prototype.copy = function(src, dest, options, callback) {
  if(typeof(options) == 'function') {
    callback = options;
    options = {};
  }
  options = options || {};

  callback = callback || function() {};

  var self = this;
  var command;
  var copyFile = src;
  var tmpFile;
  var pemFile;

  this._debug('copy file - src: %s, dest: %s, vars: %j', src, dest, options.vars);

  //lets do templating
  if(options.vars) {
    self._applyTemplate(src, options.vars, function(err, content) {
      if(err) {
        callback(err);
      } else {
        self._withSshClient(putContent(content));
      }
    });
  } else {
    self._withSshClient(putFile(copyFile));
  }

  function putContent(content) {
    return function(client, done) {
      client.putContent(content, dest, function(err) {
        done();
        (err)? callback(err) : callback(null, 0, {});
      })
    };
  }

  function putFile(copyFile) {
    var putFileOptions = {};

    if(options.progressBar) {
      var bar = new ProgressBar("[:bar] :percent :etas", {
        complete: "=",
        incomplete: ' ',
        width: 40,
        total: 100,
        clear: true
      });

      putFileOptions.onProgress = function (completedPercentage) {
        bar.update(completedPercentage / 100);
      };
    }

    return function(client, done) {
      client.putFile(copyFile, dest, putFileOptions, function(err) {
        done();
        (err)? callback(err) : callback(null, 0, {});
      })
    };
  }
};

Session.prototype.execute = function(shellCommand, options, callback) {
  if(typeof(options) == 'function') {
    callback = options;
    options = {};
  }
  options = options || {};
  callback = callback || function() {};

  this._withSshClient(function(client, done) {
    client.execute(shellCommand, options, function(err, context) {
      done();
      if(err) {
        callback(err);
      } else {
        callback(null, context.code, context);
      }
    });
  });
};

Session.prototype.executeScript = function(scriptFile, options, callback) {
  if(typeof(options) == 'function') {
    callback = options;
    options = {};
  }
  callback = callback || function() {};
  options = options || {};
  options.vars = options.vars || {};


  var self = this;

  this._applyTemplate(scriptFile, options.vars, function(err, content) {
    if(err) {
      callback(err);
    } else {
      self.execute(content, options, callback);
    }
  });
};

Session.prototype._applyTemplate = function(file, vars, callback) {
  var self = this;
  fs.readFile(file, {encoding: 'utf8'}, function(err, content) {
    if(err) {
      callback(err);
    } else {
      if(vars) {
        var ejsOptions = self._options.ejs || {};
        var content = ejs.compile(content, ejsOptions)(vars);
      }
      callback(null, content);
    }
  });
};

Session.prototype.close = function() {
  if(this._keepAliveClient) {
    this._keepAliveClient.close();
  }
};

module.exports = Session;
