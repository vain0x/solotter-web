import * as express from 'express';

export const indexRouter = () => {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.render('index', {
      title: 'Solotter',
    });
  });

  return router;
};

type AsyncRequestHandler = (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>;

export const asyncMiddleware = (asyncFunc: AsyncRequestHandler): express.RequestHandler => {
  return (req, res, next) => {
    let promise;

    try {
      promise = asyncFunc(req, res, next);
    } catch (ex) {
      console.error({ error: ex });
      return next(ex);
    }

    promise.catch((ex: any) => {
      console.error({ error: ex });
      next(ex);
    });
  };
};

export const middleware = (func: express.RequestHandler): express.RequestHandler => {
  return (req, res, next) => {
    try {
      return func(req, res, next);
    } catch (ex) {
      console.error({ error: ex });
      next(ex);
    }
  };
};
