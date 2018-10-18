import * as express from 'express';
import { TwitterAppService } from '../models/twitter-service';
import { requireAuthMiddleware } from './auth';


export const createTwitterUserService = (req: express.Request) => {
  const twitterAppService = new TwitterAppService();

  const t = req.session.twitter;
  return twitterAppService.userService(t.accessToken, t.user);
};

export const tweetRouter = () => {
  const router = express.Router();

  router.all('*', requireAuthMiddleware);

  router.get('/', (req, res, next) => {
    const screenName = req.session.twitter.user.screenName;

    res.render('tweet', {
      title: 'Tweet | Solotter',
      twitterUser: {
        screenName: `@${screenName}`,
      },
      status: req.query.status,
      errorMessage: req.query.error_message,
      csrfToken: req.csrfToken(),
    });
  });

  router.post('/post-tweet', (req, res, next) => {
    const twitterUserService = createTwitterUserService(req);

    const content = req.body.tweet_content;

    twitterUserService.postTweet(content).then(
      _ => {
        res.redirect('/tweet/?status=success');
      },
      error => {
        console.error(error);
        res.redirect('/tweet/?status=error');
      });
  });

  return router;
};
