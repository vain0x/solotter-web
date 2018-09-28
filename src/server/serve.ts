import * as express from 'express';
import * as serveStatic from 'serve-static';
import * as path from 'path';

export const serve = () => {
  const hostname = 'localhost';
  const port = +(process.env.PORT || '8080');
  const distDir = path.normalize(process.env.DIST_DIR || './dist');
  const publicDir = path.normalize(distDir + '/public');

  const app = express();

  app.use(serveStatic(publicDir));

  app.listen(port, hostname, () => {
    console.log(`Serves ${publicDir}`);
    console.log(`Start listening http://${hostname}:${port}/`);
  });
};
