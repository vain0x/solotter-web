const Enumerable = require("linq");

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
};

const UserGroupFactory = new class {
  fromPath(userGroupPath, defaultScreenName, twitterClient) {
    const userGroupKey = UserGroupPathFormat.parse(userGroupPath, defaultScreenName);
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
};

class FriendsUserGroup {
  constructor(group, twitterClient) {
    this.group = group;
    this.twitterClient = twitterClient;

    if (this.group !== FriendsUserGroup.type) {
      throw new Error("Invalid group type.");
    }
  }

  async fetchMembers() {
    const option = {
      "screen_name": this.group.ownerScreenName,
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
  constructor(group, twitterClient) {
    this.group = group;
    this.twitterClient = twitterClient;

    if (group !== FollowersUserGroup.type) {
      throw new Error("Invalid group type.");
    }
  }

  async fetchMembers() {
    // Almost the same as friends.
    const option = {
      "screen_name": this.group.ownerScreenName,
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
  consturctor(group, twitterClient) {
    this.group = group;
    this.twitterClient = twitterClient;

    if (group !== ListUserGroup.type) {
      throw new Error("Invalid group type.");
    }
  }

  async fetchMembers(group, twitterClient) {
    // Almost the same as friends.
    const option = {
      "slug": group.slug,
      "owner_screen_name": group.ownerScreenName,
      "count": 5000,
      "skip_status": true,
      "include_user_entities": false,
    };

    const results =
      await Util.fetchCursor(option, option => twitterClient.get("lists/members", option));
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
    for (const userChunk of this.chunkify(users, limit)) {
      if (userChunk.length === 0) continue;

      // NOTE: Must pass parameters via query string rather than body (FormData format).
      // Because `post` adds ".json" to the end of url, end url with dummy parameter.
      // URLSearchParams joins array of string with ",".
      const query = new URLSearchParams({
        owner_screen_name: this.group.ownerScreenName,
        slug: this.group.slug,
        screen_name: userChunk.map(user => user.screenName),
      });
      await this.twitterClient.post(`lists/members/create_all.json?${query.toString()}&dummy=`, {});
    }
  }

  async removeMembers(users) {
    // Essentially same as addMembers.

    const limit = 100;
    for (const userChunk of this.chunkify(users, limit)) {
      if (userChunk.length === 0) continue;

      // NOTE: Must pass parameters via query string rather than body (FormData format).
      // Because `post` adds ".json" to the end of url, end url with dummy parameter.
      // URLSearchParams joins array of string with ",".
      const query = new URLSearchParams({
        owner_screen_name: this.group.ownerScreenName,
        slug: this.group.slug,
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
      const chunk = xs.slice(i * limit, (i + 1) * limit);
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
}

module.exports = {
  UserGroupPathFormat,
  UserGroupFactory,
  diffUserList: Util.diffUserList,
};
