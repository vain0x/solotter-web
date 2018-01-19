const { URL, URLSearchParams } = require("url");
const Twitter = require("twitter");
const { OAuth } = require('oauth');
const Enumerable = require("linq");

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

  userService(accessToken, user) {
    const a = accessToken;
    const twitterClient = new Twitter({
      consumer_key: a.consumerKey,
      consumer_secret: a.consumerSecret,
      access_token_key: a.accessTokenKey,
      access_token_secret: a.accessTokenSecret,
    });

    return new TwitterUserService(twitterClient, user);
  }
}

class TwitterUserService {
  constructor(twitterClient, user) {
    this.twitterClient = twitterClient;
    this.user = user;
  }

  /**
   * Performs fetch operations, moving the cursor to end.
   */
  async fetchCursor(option, fetch) {
    if (option["cursor"] !== undefined) {
      throw new Error("Don't specify cursor.");
    }

    const localOption = Object.assign({}, option);
    localOption["cursor"] = -1;

    const results = [];

    while (true) {
      const result = await fetch(localOption);
      results.push(result);

      const nextCursor = result["next_cursor"];
      if (nextCursor === 0) break;
      localOption["cursor"] = nextCursor;
    }

    return results;
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

  async lists() {
    const r = await this.twitterClient.get("lists/list", {});
    return r.map(list => ({
      slung: list.slung,
      name: list.name,
    }));
  }

  async friends(screenName) {
    const option = {
      "screen_name": screenName,
      "count": 5000,
      "skip_status": true,
      "include_user_entities": false,
    };
    const results =
      await this.fetchCursor(option, option => this.twitterClient.get("friends/list", option));
    const users =
      Enumerable.from(results)
      .selectMany(result => result["users"])
      .select(user => ({
        userId: user["id"],
        screenName: user["screen_name"],
        name: user["name"],
      }))
      .toArray();
    return users;
  }

  async listMembers(slug, ownerScreenName) {
    const option = {
      "slug": slug,
      "owner_screen_name": ownerScreenName,
      "count": 5000,
      "skip_status": true,
      "include_user_entities": false,
    };

    const results =
      await this.fetchCursor(option, option => this.twitterClient.get("lists/members", option));
    const users =
      Enumerable.from(results)
      .selectMany(result => result["users"])
      .select(user => ({
        userId: user["id"],
        screenName: user["screen_name"],
        name: user["name"],
      }))
      .toArray();
    return users;
  }

  async members(slug) {
    if (slug === "@friends") {
      return await this.friends(this.user.screenName);
    }

    return await this.listMembers(slug, this.user.screenName);
  }

  chunkify(xs, limit) {
    const xss = [];
    for (let i = 0; i < xs.length; i += limit) {
      const chunk = xs.slice(i * limit, (i + 1) * limit);
      if (chunk.length === 0) throw new Error("Should be nonempty.");
      xss.push(chunk);
    }
    return xss;
  }

  async addMembers(slug, screenNames) {
    console.error(`Adding members to ${slug}: ${screenNames.join(",")}`);

    const limit = 100;
    for (const paginatedScreenNames in this.chunkify(screenNames, limit)) {
      if (paginatedScreenNames.length === 0) continue;

      // NOTE: Must pass parameters via query string rather than body (FormData format).
      // Because `post` adds ".json" to the end of url, end url with dummy parameter.
      const query = new URLSearchParams({
        owner_screen_name: this.user.screenName,
        slug,
        screen_name: paginatedScreenNames,
      });
      await this.twitterClient.post(`lists/members/create_all.json?${query.toString()}&dummy=`, {});
    }
  }

  async removeMembers(slug, screenNames) {
    // Essentially same as addMembers.

    console.error(`Removing members from ${slug}: ${screenNames.join(",")}`);
    const limit = 100;
    for (const paginatedScreenNames in this.chunkify(screenNames, limit)) {
      if (paginatedScreenNames.length === 0) continue;

      // NOTE: Must pass parameters via query string rather than body (FormData format).
      // Because `post` adds ".json" to the end of url, end url with dummy parameter.
      const query = new URLSearchParams({
        owner_screen_name: this.user.screenName,
        slug,
        screen_name: paginatedScreenNames,
      });
      await this.twitterClient.post(`lists/members/destroy_all.json?${query.toString()}&dummy=`, {});
    }
  }

  diffUserList(oldUsers, newUsers) {
    const oldUserScreenNames =
      new Set(oldUsers.map(user => user.screenName));
    const newUserScreenNames =
      new Set(newUsers.map(user => user.screenName));
    const removedUsers =
      oldUsers.filter(user => !newUserScreenNames.has(user.screenName));
    const addedUsers =
      newUsers.filter(user => !oldUserScreenNames.has(user.screenName));
    return { addedUsers, removedUsers };
  }

  async applyDiff(slug, diff) {
    const { addedUsers, removedUsers } = diff;
    if (slug === "@friends") {
      throw new Error("NOT SUPPORTED.");
    }

    await this.removeMembers(slug, removedUsers.map(u => u.screenName));
    await this.addMembers(slug, addedUsers.map(u => u.screenName));
  }

  async exportList(slug) {
    const users = await this.members(slug);
    return JSON.stringify(users, null, "  ");
  }

  async importList(slug, json) {
    const oldUsers = await this.members(slug);
    const newUsers = JSON.parse(json);
    const diff = this.diffUserList(oldUsers, newUsers);
    await this.applyDiff(slug, diff);
  }
}

module.exports = { TwitterAppService, TwitterUserService };
