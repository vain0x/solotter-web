const Twitter = require("twitter");
const TwitterPin = require("twitter-pin");
const opn = require("opn");

class TwitterService {
  static authenticate() {
    const e = process.env;
    return {
      consumerKey: e.TWITTER_CONSUMER_KEY,
      consumerSecret: e.TWITTER_CONSUMER_SECRET,
      accessTokenKey: e.TWITTER_ACCESS_TOKEN_KEY,
      accessTokenSecret: e.TWITTER_ACCESS_TOKEN_SECRET,
    };
  }

  static twitterClient() {
    const accessToken = TwitterService.authenticate();

    return new Twitter({
      consumer_key: accessToken.consumerKey,
      consumer_secret: accessToken.consumerSecret,
      access_token_key: accessToken.accessTokenKey,
      access_token_secret: accessToken.accessTokenSecret,
  });
  }

  async postTweet(status) {
    const client = TwitterService.twitterClient();

    return await client.post(
      "statuses/update",
      {
         status,
         trim_user: true,
      }
    );
  }
}

module.exports = TwitterService;
