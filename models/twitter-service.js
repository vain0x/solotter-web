const Twitter = require("twitter");
const { OAuth } = require('oauth');

class TwitterAppService {
  constructor() {
    const e = process.env;

    this.accessToken = {
      consumerKey: e.TWITTER_CONSUMER_KEY,
      consumerSecret: e.TWITTER_CONSUMER_SECRET,
    };

    this.oa = new OAuth(
      "https://twitter.com/oauth/request_token",
      "https://twitter.com/oauth/access_token",
      this.accessToken.consumerKey,
      this.accessToken.consumerSecret,
      "1.0",
      e.TWITTER_OAUTH_CALLBACK_URI,
      "HMAC-SHA1"
    );
  }

  authenticate() {
    return new Promise((resolve, reject) => {
      this.oa.getOAuthRequestToken((error, oauthTokenKey, oauthTokenSecret) => {
        if (error) {
          reject(error);
          return;
        }

        const redirectURI = `https://twitter.com/oauth/authenticate?oauth_token=${oauthTokenKey}`;
        resolve({
          redirectURI,
          oauthToken: {
            oauthTokenKey,
            oauthTokenSecret,
          },
        });
      });
    });
  }

  acceptAuthenticationCallback(oauthToken, oauthVerifier) {
    return new Promise((resolve, reject) => {
      this.oa.getOAuthAccessToken(oauthToken.oauthTokenKey, oauthToken.oauthTokenSecret, oauthVerifier, (error, accessTokenKey, accessTokenSecret, results) => {
        console.log(results);
        if (error) {
          reject(error);
          return;
        }

        resolve({
          twitter: {
            accessToken: {
              accessTokenKey,
              accessTokenSecret,
              ...this.accessToken,
            },
            user: {
              screenName: results["screen_name"],
            },
          },
        });
      });
    });
  }

  userService(accessToken) {
    const a = accessToken;
    const twitterClient = new Twitter({
      consumer_key: a.consumerKey,
      consumer_secret: a.consumerSecret,
      access_token_key: a.accessTokenKey,
      access_token_secret: a.accessTokenSecret,
    });

    return new TwitterUserService(twitterClient);
  }
}

class TwitterUserService {
  constructor(twitterClient) {
    this.twitterClient = twitterClient;
  }

  async postTweet(status) {
    return await this.twitterClient.post(
      "statuses/update",
      {
        status,
        trim_user: true,
      }
    );
  }
}

module.exports = { TwitterAppService, TwitterUserService };
