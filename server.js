
/**
 * Module dependencies.
 */

var app = require('./app');
var debug = require('debug')('solotter-web:server');
var http = require('http');

class SolotterServer {
  run() {
    /**
     * Get port from environment and store in Express.
     */

    this.port = this.normalizePort(process.env.PORT || '3000');
    app.set('port', this.port);

    /**
     * Create HTTP server.
     */

    this.server = http.createServer(app);

    /**
     * Listen on provided port, on all network interfaces.
     */

    this.server.listen(this.port);
    this.server.on('error', err => this.onError(err));
    this.server.on('listening', () => this.onListening());
  }

  /**
   * Normalize a port into a number, string, or false.
   */
  normalizePort(val) {
    var port = parseInt(val, 10);

    if (isNaN(port)) {
      // named pipe
      return val;
    }

    if (port >= 0) {
      // port number
      return port;
    }

    return false;
  }

  /**
   * Event listener for HTTP server "error" event.
   */
  onError(error) {
    if (error.syscall !== 'listen') {
      throw error;
    }

    var bind = typeof this.port === 'string'
      ? 'Pipe ' + this.port
      : 'Port ' + this.port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
      case 'EACCES':
        console.error(bind + ' requires elevated privileges');
        process.exit(1);
        break;
      case 'EADDRINUSE':
        console.error(bind + ' is already in use');
        process.exit(1);
        break;
      default:
        throw error;
    }
  }

  /**
   * Event listener for HTTP server "listening" event.
   */
  onListening() {
    var addr = this.server.address();
    var bind = typeof addr === 'string'
      ? 'pipe ' + addr
      : 'port ' + addr.port;
    debug('Listening on ' + bind);
  }
}

module.exports = SolotterServer;
