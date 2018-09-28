import * as express from 'express';
import { TwitterAppService } from '../models/twitter-service';
import { middleware } from './index';

// The default end-point for logged-in users.
const homePath = '/tweet/';

const isLoggedIn = (req: express.Request) => {
  const t = req.session.twitter;
  if (t === undefined) {
    return false;
  }
  return t.accessToken !== undefined;
};

/**
 * A middleware to require authentication if not.
 */
export const requireAuthMiddleware = middleware((req, res, next) => {
  if (!isLoggedIn(req)) {
    res.redirect('/auth/login/');
    return;
  }

  next();
});

/**
 * A middleware to skip authentication if done.
 */
export const skipAuthMiddleware: express.RequestHandler = (req, res, next) => {
  if (isLoggedIn(req)) {
    res.redirect(homePath);
    return;
  }

  next();
};

export const authRouter = () => {
  const router = express.Router();
  const twitterAppService = new TwitterAppService();

  router.post('/logout', (req, res, next) => {
    req.session.twitter = undefined;
    res.redirect('/');
  });

  router.all('*', skipAuthMiddleware);

  router.get('/login', async (req, res, next) => {
    res.render('auth-login', {
      title: 'Login with Twitter | Solotter',
      csrfToken: req.csrfToken(),
    });
  });

  router.post('/login', async (req, res, next) => {
    const { redirectURI, oauthToken } = await twitterAppService.authenticate();
    req.session.twitterOAuth = {
      redirectURI,
      oauthToken,
    };
    res.redirect(req.session.twitterOAuth.redirectURI);
  });

  router.get('/callback', async (req, res, next) => {
    const oauthToken = req.session.twitterOAuth && req.session.twitterOAuth.oauthToken;
    const oauthVerifier = req.query.oauth_verifier;

    if (oauthToken === undefined || oauthVerifier === undefined) {
      res.status(403);
      return;
    }

    const { twitter } = await twitterAppService.acceptAuthenticationCallback(oauthToken, oauthVerifier);

    req.session.twitter = twitter;
    res.redirect(homePath);
  });

  return router;
};
