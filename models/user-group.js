

const GroupPathFormat = new class {
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

module.exports = {
  GroupPathFormat,
};
