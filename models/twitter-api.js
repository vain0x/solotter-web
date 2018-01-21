const { OAuth } = require("oauth");

/**
 * Represents a twitter app, not requiring user authentication.
 */
class TwitterAppAPI {
  constructor(accessToken, callbackURI) {
    this.accessToken = accessToken;
    this.callbackURI = callbackURI;

    this.oa =
      new OAuth(
        "https://twitter.com/oauth/request_token",
        "https://twitter.com/oauth/access_token",
        this.accessToken.consumerKey,
        this.accessToken.consumerSecret,
        "1.0",
        callbackURI,
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
        const oauthToken = { oauthTokenKey, oauthTokenSecret };
        resolve({ redirectURI, oauthToken });
      });
    });
  }

  acceptAuthenticationCallback(oauthToken, oauthVerifier) {
    return new Promise((resolve, reject) => {
      this.oa.getOAuthAccessToken(oauthToken.oauthTokenKey, oauthToken.oauthTokenSecret, oauthVerifier, (error, accessTokenKey, accessTokenSecret, results) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          twitter: {
            accessToken: {
              consumerKey: this.accessToken.consumerKey,
              consumerSecret: this.accessToken.consumerSecret,
              accessTokenKey,
              accessTokenSecret,
            },
            user: {
              screenName: results["screen_name"],
            },
          },
        });
      });
    });
  }
}

module.exports = {
  TwitterAppAPI,
};
