const Twitter = require("twitter");
const { TwitterAppAPI } = require("./twitter-api");
const { UserGroupFactory, diffUserList, fetchOwnedListSlugs } = require("./user-group");

/**
 * Represents a twitter app, not requiring user authentication.
 */
class TwitterAppService {
  constructor() {
    const e = process.env;

    const accessToken = {
      consumerKey: e.TWITTER_CONSUMER_KEY,
      consumerSecret: e.TWITTER_CONSUMER_SECRET,
    };

    const callbackURI = e.TWITTER_OAUTH_CALLBACK_URI;

    this.api = new TwitterAppAPI(accessToken, callbackURI);
  }

  authenticate() {
    return this.api.authenticate();
  }

  acceptAuthenticationCallback(oauthToken, oauthVerifier) {
    return this.api.acceptAuthenticationCallback(oauthToken, oauthVerifier);
  }

  userService(accessToken, user) {
    const a = accessToken;
    const twitterClient =
      new Twitter({
        consumer_key: a.consumerKey,
        consumer_secret: a.consumerSecret,
        access_token_key: a.accessTokenKey,
        access_token_secret: a.accessTokenSecret,
      });

    return new TwitterUserService(twitterClient, user);
  }
}

/**
 * Represents a twitter app, requiring user authentication.
 */
class TwitterUserService {
  constructor(twitterClient, user) {
    this.twitterClient = twitterClient;
    this.user = user;
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

  async allUserGroups() {
    const screenName = this.user.screenName;
    const twitterClient = this.twitterClient;

    const listSlugs = await fetchOwnedListSlugs(screenName, twitterClient);
    const userGroups = UserGroupFactory.all(screenName, listSlugs, twitterClient);

    return userGroups;
  }

  async exportList(userGroupPath) {
    const userGroup = UserGroupFactory.fromPath(userGroupPath, this.user.screenName, this.twitterClient);
    const users = await userGroup.fetchMembers();
    return JSON.stringify(users, null, "  ");
  }

  async importList(userGroupPath, json) {
    const userGroup = UserGroupFactory.fromPath(userGroupPath, this.user.screenName, this.twitterClient);
    const newUsers = JSON.parse(json);

    const oldUsers = await userGroup.fetchMembers(userGroup);
    const diff = diffUserList(oldUsers, newUsers);
    await userGroup.patch(userGroup, diff);
  }
}

module.exports = { TwitterAppService, TwitterUserService };
