import * as express from 'express';
import * as http from 'http';

/**
 * Normalize a port into a number, string, or false.
 */
const normalizePort = (val: string) => {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
};

/**
 * Event listener for HTTP server "error" event.
 */
const onError = (server: http.Server, port: string | number, error: Error & { syscall: string, code: string }) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = (typeof port === 'string' ? 'Pipe' : 'Port') + ' ' + port;

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
};

/**
 * Event listener for HTTP server "listening" event.
 */
const onListening = (server: http.Server) => {
  const addr = server.address();
  const bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  console.log('Listening on ' + bind);
};

export const startServer = (
  app: express.Application,
) => {
  const port = normalizePort(process.env.PORT || '3000');
  if (port === false) {
    throw new Error("Couldn't normalize port number.");
  }
  app.set('port', port);

  const server = http.createServer(app);
  server.listen(port);
  server.on('error', err => onError(server, port, err as any));
  server.on('listening', () => onListening(server));
};
