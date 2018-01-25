const Enumerable = require("linq");
const { URLSearchParams } = require("url");

const UserGroupPathFormat = new class {
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
  parse(groupPath, defaultScreenName) {
    const reg = new RegExp(String.raw`^(?:@([\w\d_-]+)/)?([\w\d_-]+)$`);
    const match = groupPath.match(reg);
    if (match === null) throw Error("Invalid group path");

    const [, screenName, slug] = match;
    const ownerScreenName = screenName || defaultScreenName;
    const type = slug === "_friends" || slug === "_followers" ? slug.substr(1) : "list";
    return { type, ownerScreenName, slug };
  }

  unparse(userGroupKey) {
    return `@${userGroupKey.ownerScreenName}/${userGroupKey.slug}`;
  }
};

const UserGroupFactory = new class {
  fromPath(userGroupPath, defaultScreenName, twitterClient) {
    const userGroupKey = UserGroupPathFormat.parse(userGroupPath, defaultScreenName);
    return this.fromKey(userGroupKey, twitterClient);
  }

  fromKey(userGroupKey, twitterClient) {
    switch (userGroupKey.type) {
      case "friends":
        return new FriendsUserGroup(userGroupKey, twitterClient);
      case "followers":
        return new FollowersUserGroup(userGroupKey, twitterClient);
      case "list":
        return new ListUserGroup(userGroupKey, twitterClient);
      default:
        throw new Error("Invalid group type.");
    }
  }

  all(screenName, listSlugs, twitterClient) {
    const keys =
      Enumerable
        .from([
          { ownerScreenName: screenName, type: FriendsUserGroup.type(), slug: "_friends" },
          { ownerScreenName: screenName, type: FollowersUserGroup.type(), slug: "_followers" },
        ])
        .concat(listSlugs.map(slug => {
          return { ownerScreenName: screenName, type: ListUserGroup.type(), slug };
        }));
    const userGroups = keys.select(key => this.fromKey(key, twitterClient));
    return userGroups.toArray();
  }
};

class FriendsUserGroup {
  constructor(userGroupKey, twitterClient) {
    if (userGroupKey.type !== FriendsUserGroup.type) {
      throw new Error("Invalid group type.");
    }

    this.userGroupKey = userGroupKey;
    this.twitterClient = twitterClient;
  }

  get path() {
    return UserGroupPathFormat.unparse(this.userGroupKey);
  }

  async fetchMembers() {
    const option = {
      "screen_name": this.userGroupKey.ownerScreenName,
      "count": 5000,
      "skip_status": true,
      "include_user_entities": false,
    };
    const results =
      await Util.fetchCursor(option, option => this.twitterClient.get("friends/list", option));
    const users =
      Enumerable
        .from(results)
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
   * Applies diff of members.
   */
  async patch(_diff) {
    throw new Error("Use group of friends doesn't support patching.");
  }

  static get type() {
    return "friends";
  }
}

class FollowersUserGroup {
  constructor(userGroupKey, twitterClient) {
    if (userGroupKey.type !== FollowersUserGroup.type) {
      throw new Error("Invalid group type.");
    }

    this.userGroupKey = userGroupKey;
    this.twitterClient = twitterClient;
  }

  get path() {
    return UserGroupPathFormat.unparse(this.userGroupKey);
  }

  async fetchMembers() {
    // Almost the same as friends.
    const option = {
      "screen_name": this.userGroupKey.ownerScreenName,
      "count": 5000,
      "skip_status": true,
      "include_user_entities": false,
    };
    const results =
      await Util.fetchCursor(option, option => this.twitterClient.get("followers/list", option));
    const users =
      Enumerable
        .from(results)
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
   * Applies diff of members.
   */
  async patch(_diff) {
    throw new Error("Use group of followers doesn't support patching.");
  }

  static get type() {
    return "followers";
  }
}

class ListUserGroup {
  constructor(userGroupKey, twitterClient) {
    if (userGroupKey.type !== ListUserGroup.type) {
      throw new Error("Invalid group type.");
    }

    this.userGroupKey = userGroupKey;
    this.twitterClient = twitterClient;
  }

  get path() {
    return UserGroupPathFormat.unparse(this.userGroupKey);
  }

  async fetchMembers() {
    // Almost the same as friends.
    const option = {
      "slug": this.userGroupKey.slug,
      "owner_screen_name": this.userGroupKey.ownerScreenName,
      "count": 5000,
      "skip_status": true,
      "include_user_entities": false,
    };

    const results =
      await Util.fetchCursor(option, option => this.twitterClient.get("lists/members", option));
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

  async addMembers(users) {
    const limit = 100;
    for (const userChunk of Util.chunkify(users, limit)) {
      if (userChunk.length === 0) continue;

      // NOTE: Must pass parameters via query string rather than body (FormData format).
      // Because `post` adds ".json" to the end of url, end url with dummy parameter.
      // URLSearchParams joins array of string with ",".
      const query = new URLSearchParams({
        owner_screen_name: this.userGroupKey.ownerScreenName,
        slug: this.userGroupKey.slug,
        screen_name: userChunk.map(user => user.screenName),
      });
      await this.twitterClient.post(`lists/members/create_all.json?${query.toString()}&dummy=`, {});
    }
  }

  async removeMembers(users) {
    // Essentially same as addMembers.

    const limit = 100;
    for (const userChunk of Util.chunkify(users, limit)) {
      if (userChunk.length === 0) continue;

      // NOTE: Must pass parameters via query string rather than body (FormData format).
      // Because `post` adds ".json" to the end of url, end url with dummy parameter.
      // URLSearchParams joins array of string with ",".
      const query = new URLSearchParams({
        owner_screen_name: this.userGroupKey.ownerScreenName,
        slug: this.userGroupKey.slug,
        screen_name: userChunk.map(user => user.screenName),
      });
      await this.twitterClient.post(`lists/members/destroy_all.json?${query.toString()}&dummy=`, {});
    }
  }

  /**
   * Applies diff of members.
   */
  async patch(diff) {
    const { addedUsers, removedUsers } = diff;
    await this.removeMembers(removedUsers);
    await this.addMembers(addedUsers);
  }

  static get type() {
    return "list";
  }
}

const Util = new class {
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

  chunkify(xs, limit) {
    const xss = [];
    for (let i = 0; i < xs.length; i += limit) {
      const chunk = xs.slice(i, i + limit);
      if (chunk.length === 0) throw new Error("Should be nonempty.");
      xss.push(chunk);
    }
    return xss;
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
    return { oldUsers, newUsers, removedUsers, addedUsers };
  }

  async fetchOwnedListSlugs(screenName, twitterClient) {
    const option =
      {
        screen_name: screenName,
        count: 1000,
      };
    const results = await this.fetchCursor(option, option => twitterClient.get("lists/ownerships", option));
    const slugs =
      Enumerable
        .from(results)
        .selectMany(r => r["lists"])
        .select(list => list.slug)
        .toArray();
    return slugs;
  }
}

module.exports = {
  UserGroupPathFormat,
  UserGroupFactory,
  diffUserList: Util.diffUserList,
  fetchOwnedListSlugs: Util.fetchOwnedListSlugs,
};
