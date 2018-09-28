import Enumerable = require('linq');
import Twitter = require('twitter');
import { URLSearchParams } from 'url';
import {
  TwitterList,
  TwitterScreenName,
  TwitterUser,
  TwitterUserId,
  UserGroupKey,
  UserGroupPath,
} from '../../core/twitter/types';

type TwitterClient = Twitter;

interface UserListDiff {
  oldUsers: TwitterUser[];
  newUsers: TwitterUser[];
  removedUsers: TwitterUser[];
  addedUsers: TwitterUser[];
}

interface UserGroup {
  path: UserGroupPath;

  userGroupKey: UserGroupKey;

  fetchMembers(): Promise<TwitterUser[]>;

  /**
   * Applies diff of members.
   */
  patch(diff: UserListDiff): Promise<void>;
}

interface FetchCursorOption {
  cursor?: number | undefined;
  count: number;
}

/**
 * Performs fetch operations, moving the cursor to end.
 */
const fetchCursor = async (
  option: FetchCursorOption,
  fetch: (option: FetchCursorOption) => Promise<object>,
) => {
  if (option.cursor !== undefined) {
    throw new Error("Don't specify cursor.");
  }

  const localOption = Object.assign({}, option);
  localOption.cursor = -1;

  const results = [];

  while (true) {
    const result = await fetch(localOption);
    results.push(result);

    const nextCursor = (result as any).next_cursor;
    if (nextCursor === 0) { break; }
    localOption.cursor = nextCursor;
  }

  return results;
};

const chunkify = <T>(xs: T[], limit: number): T[][] => {
  const xss = [];
  for (let i = 0; i < xs.length; i += limit) {
    const chunk = xs.slice(i, i + limit);
    if (chunk.length === 0) { throw new Error('Should be nonempty.'); }
    xss.push(chunk);
  }
  return xss;
};

export const diffUserList = (oldUsers: TwitterUser[], newUsers: TwitterUser[]): UserListDiff => {
  const oldUserScreenNames =
    new Set(oldUsers.map(user => user.screenName));
  const newUserScreenNames =
    new Set(newUsers.map(user => user.screenName));
  const removedUsers =
    oldUsers.filter(user => !newUserScreenNames.has(user.screenName));
  const addedUsers =
    newUsers.filter(user => !oldUserScreenNames.has(user.screenName));
  return { oldUsers, newUsers, removedUsers, addedUsers };
};

export const fetchOwnedListSlugs = async (
  screenName: TwitterScreenName,
  twitterClient: TwitterClient,
) => {
  const option = {
    screen_name: screenName,
    count: 1000,
  };
  const results = await fetchCursor(option, o => twitterClient.get('lists/ownerships', o));
  const slugs =
    Enumerable
      .from(results)
      .selectMany((r: any) => r.lists as TwitterList[])
      .select(list => list.slug)
      .toArray();
  return slugs;
};

export const UserGroupPathFormat = new class {
  /**
   * Parses a group path, a string to specify a collection of users, into an object.
   * e.g.
   *  @john/_friends (users that @john follows),
   *  @john/_followers (users that follows @john),
   *  @john/some-list-slug (users of tha list 'some-list-slug' owned by @john),
   *  _friends (= @<login-user>/_friends),
   *  some-slug (= @<login-user>/some-slug).
   * @param {*} userGroupPath
   * @returns { type, ownerScreenName, slug }
   */
  public parse(userGroupPath: UserGroupPath, defaultScreenName: string): UserGroupKey {
    userGroupPath = (userGroupPath || '').trim();

    if (userGroupPath === '') {
      return EmptyUserGroup.userGroupKey;
    }

    const reg = new RegExp(this.regexpPattern);
    const match = userGroupPath.match(reg);
    if (match === null) { throw Error('Invalid group path'); }

    const [, screenName, slug] = match;
    const ownerScreenName = screenName || defaultScreenName;
    const type = slug === '_friends' || slug === '_followers' ? slug.substr(1) : 'list';
    return { type, ownerScreenName, slug };
  }

  public unparse(userGroupKey: UserGroupKey) {
    if (userGroupKey.type === EmptyUserGroup.type) {
      return '';
    }

    return `@${userGroupKey.ownerScreenName}/${userGroupKey.slug}`;
  }

  public get regexpPattern() {
    return String.raw`^(?:@([\w\d_-]+)/)?([\w\d_-]+)$`;
  }
}();

export const UserGroupFactory = new class {
  public fromPath(
    userGroupPath: UserGroupPath,
    defaultScreenName: TwitterScreenName,
    twitterClient: Twitter,
  ) {
    const userGroupKey = UserGroupPathFormat.parse(userGroupPath, defaultScreenName);
    return this.fromKey(userGroupKey, twitterClient);
  }

  public fromKey(
    userGroupKey: UserGroupKey,
    twitterClient: Twitter,
  ): UserGroup {
    switch (userGroupKey.type) {
      case 'empty':
        return EmptyUserGroup;
      case 'friends':
        return new FriendsUserGroup(userGroupKey, twitterClient);
      case 'followers':
        return new FollowersUserGroup(userGroupKey, twitterClient);
      case 'list':
        return new ListUserGroup(userGroupKey, twitterClient);
      default:
        throw new Error('Invalid group type.');
    }
  }

  public all(
    screenName: TwitterScreenName,
    listSlugs: string[],
    twitterClient: Twitter,
  ) {
    const keys =
      Enumerable
        .from([
          { ownerScreenName: screenName, type: FriendsUserGroup.type, slug: '_friends' },
          { ownerScreenName: screenName, type: FollowersUserGroup.type, slug: '_followers' },
        ])
        .concat(listSlugs.map(slug => {
          return { ownerScreenName: screenName, type: ListUserGroup.type, slug };
        }));
    const userGroups = keys.select(key => this.fromKey(key, twitterClient));
    return userGroups.toArray();
  }
}();

export class FriendsUserGroup implements UserGroup {
  constructor(
    public readonly userGroupKey: UserGroupKey,
    private readonly twitterClient: TwitterClient,
  ) {
    if (userGroupKey.type !== FriendsUserGroup.type) {
      throw new Error('Invalid group type.');
    }
  }

  get path() {
    return UserGroupPathFormat.unparse(this.userGroupKey);
  }

  public async fetchMembers() {
    const option = {
      screen_name: this.userGroupKey.ownerScreenName,
      count: 5000,
      skip_status: true,
      include_user_entities: false,
    };
    const results =
      await fetchCursor(option, _ => this.twitterClient.get('friends/list', option));
    const users =
      Enumerable
        .from(results)
        .selectMany(result => (result as any).users)
        .select((user: any) => ({
          userId: user.id,
          screenName: user.screen_name,
          name: user.name,
        }))
        .toArray();
    return users;
  }

  public async patch(diff: UserListDiff) {
    throw new Error("Use group of friends doesn't support patching.");
  }

  static get type() {
    return 'friends';
  }
}

class FollowersUserGroup implements UserGroup {
  constructor(
    public readonly userGroupKey: UserGroupKey,
    private readonly twitterClient: TwitterClient,
  ) {
    if (userGroupKey.type !== FollowersUserGroup.type) {
      throw new Error('Invalid group type.');
    }
  }

  public get path() {
    return UserGroupPathFormat.unparse(this.userGroupKey);
  }

  public async fetchMembers() {
    // Almost the same as friends.
    const option = {
      screen_name: this.userGroupKey.ownerScreenName,
      count: 5000,
      skip_status: true,
      include_user_entities: false,
    };
    const results =
      await fetchCursor(option, o => this.twitterClient.get('followers/list', o));
    const users =
      Enumerable
        .from(results)
        .selectMany((result: any) => result.users)
        .select((user: any) => ({
          userId: user.id,
          screenName: user.screen_name,
          name: user.name,
        }))
        .toArray();
    return users;
  }

  public async patch(diff: UserListDiff) {
    throw new Error("Use group of followers doesn't support patching.");
  }

  static get type() {
    return 'followers';
  }
}

class ListUserGroup implements UserGroup {
  constructor(
    public readonly userGroupKey: UserGroupKey,
    private readonly twitterClient: Twitter,
  ) {
    if (userGroupKey.type !== ListUserGroup.type) {
      throw new Error('Invalid group type.');
    }
  }

  public get path() {
    return UserGroupPathFormat.unparse(this.userGroupKey);
  }

  public async fetchMembers() {
    // Almost the same as friends.
    const option = {
      slug: this.userGroupKey.slug,
      owner_screen_name: this.userGroupKey.ownerScreenName,
      count: 5000,
      skip_status: true,
      include_user_entities: false,
    };

    const results =
      await fetchCursor(option, o => this.twitterClient.get('lists/members', o));
    const users =
      Enumerable.from(results)
        .selectMany((result: any) => result.users)
        .select((user: any) => ({
          userId: user.id,
          screenName: user.screen_name,
          name: user.name,
        }))
        .toArray();
    return users;
  }

  public async addMembers(users: TwitterUser[]) {
    const limit = 100;
    for (const userChunk of chunkify(users, limit)) {
      if (userChunk.length === 0) { continue; }

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

  public async removeMembers(users: TwitterUser[]) {
    // Essentially same as addMembers.

    const limit = 100;
    for (const userChunk of chunkify(users, limit)) {
      if (userChunk.length === 0) { continue; }

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

  public async patch(diff: UserListDiff) {
    const { addedUsers, removedUsers } = diff;
    await this.removeMembers(removedUsers);
    await this.addMembers(addedUsers);
  }

  public static get type() {
    return 'list';
  }
}

const EmptyUserGroup = new class implements UserGroup {
  public get path() {
    return '';
  }

  public async fetchMembers() {
    return [];
  }

  public async addMembers() {
    return;
  }

  public async removeMembers() {
    return;
  }

  public async patch(diff: UserListDiff) {
    throw new Error('Not implemented.');
  }

  public get type() {
    return 'empty';
  }

  public get userGroupKey() {
    return { type: this.type, ownerScreenName: '', slug: '' };
  }
}();
