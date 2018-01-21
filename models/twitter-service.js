const { URL, URLSearchParams } = require("url");
const Twitter = require("twitter");
const { OAuth } = require('oauth');
const Enumerable = require("linq");
const { TwitterAppAPI } = require("./twitter-api");

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

  async followers(screenName) {
    // Almost the same as friends.
    const option = {
      "screen_name": screenName,
      "count": 5000,
      "skip_status": true,
      "include_user_entities": false,
    };
    const results =
      await this.fetchCursor(option, option => this.twitterClient.get("followers/list", option));
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
    // Almost the same as friends.
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

  /**
   * Parses a group path, a string to specify a collection of users, into an object.
   * e.g.
   *  @john/_friends (users that @john follows),
   *  @john/_followers (users that follows @john),
   *  @john/some-list-slug (users of tha list 'some-list-slug' owned by @john),
   *  _friends (= @<login-user>/_friends),
   *  some-slug (= @<login-user>/some-slug).
   * @param {*} groupPath
   * @returns { type, ownerScreenName, slug }
   */
  parseGroupPath(groupPath, defaultScreenName) {
    const reg = new RegExp(String.raw`^(?:@([\w\d_-]+)/)?([\w\d_-]+)$`);
    const match = groupPath.match(reg);
    if (match === null) throw Error("Invalid group path");

    const [, screenName, slug] = match;
    const ownerScreenName = screenName || defaultScreenName;
    const type = slug === "_friends" || slug === "_followers" ? slug.substr(1) : "list";
    return { type, ownerScreenName, slug };
  }

  /**
   * Fetches members of the specified group.
   * @param {*} group
   */
  async members(group) {
    switch (group.type) {
      case "friends":
        return await this.friends(group.ownerScreenName);
      case "followers":
        return await this.followers(group.ownerScreenName);
      case "list":
        return await this.listMembers(group.slug, group.ownerScreenName);
      default: throw new Error("Invalid group type");
    }
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

  async addListMembers(slug, screenNames) {
    console.error(`Adding members to ${slug}: ${screenNames.join(",")}`);

    const limit = 100;
    for (const paginatedScreenNames of this.chunkify(screenNames, limit)) {
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

  async removeListMembers(slug, screenNames) {
    // Essentially same as addMembers.

    console.error(`Removing members from ${slug}: ${screenNames.join(",")}`);
    const limit = 100;
    for (const paginatedScreenNames of this.chunkify(screenNames, limit)) {
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

  async applyDiff(group, diff) {
    if (group.type !== "list") {
      throw new Error("No support for importing to friends/followers.");
    }

    const { addedUsers, removedUsers } = diff;

    await this.removeListMembers(group, removedUsers.map(u => u.screenName));
    await this.addListMembers(group, addedUsers.map(u => u.screenName));
  }

  async exportList(slug) {
    const group = this.parseGroupPath(slug, this.user.screenName);
    const users = await this.members(group);
    return JSON.stringify(users, null, "  ");
  }

  async importList(slug, json) {
    const group = this.parseGroupPath(slug, this.user.screenName);
    const newUsers = JSON.parse(json);

    const oldUsers = await this.members(group);
    const diff = this.diffUserList(oldUsers, newUsers);
    await this.applyDiff(group, diff);
  }
}

module.exports = { TwitterAppService, TwitterUserService };
