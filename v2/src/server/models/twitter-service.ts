import Twitter = require('twitter');
import { AccessToken, TwitterUser, UserGroupPath } from '../../core/twitter/types';
import { OAuthToken, TwitterAppAPI } from '../infra/twitter-api';
import { diffUserList, fetchOwnedListSlugs, UserGroupFactory } from './user-group';

type TwitterClient = Twitter;

const forceString = <T>(x: T): string => {
  if (typeof x !== 'string') {
    throw new Error(`Expected a string: ${x}.`);
  }

  return x;
};

/**
 * Represents a twitter app, not requiring user authentication.
 */
export class TwitterAppService {
  private api: TwitterAppAPI;

  constructor() {
    const e = process.env;

    const accessToken = {
      consumerKey: forceString(e.TWITTER_CONSUMER_KEY),
      consumerSecret: forceString(e.TWITTER_CONSUMER_SECRET),
    };

    const callbackURI = forceString(e.TWITTER_OAUTH_CALLBACK_URI);

    this.api = new TwitterAppAPI(accessToken, callbackURI);
  }

  public authenticate() {
    return this.api.authenticate();
  }

  public acceptAuthenticationCallback(
    oauthToken: OAuthToken,
    oauthVerifier: string,
  ) {
    return this.api.acceptAuthenticationCallback(oauthToken, oauthVerifier);
  }

  public userService(
    accessToken: AccessToken,
    user: TwitterUser,
  ) {
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
export class TwitterUserService {
  constructor(
    private readonly twitterClient: TwitterClient,
    private readonly user: TwitterUser,
  ) {
    this.twitterClient = twitterClient;
    this.user = user;
  }

  public async postTweet(status: string) {
    return await this.twitterClient.post(
      'statuses/update',
      {
        status,
        trim_user: true,
      },
    );
  }

  public async allUserGroups() {
    const screenName = this.user.screenName;
    const twitterClient = this.twitterClient;

    const listSlugs = await fetchOwnedListSlugs(screenName, twitterClient);
    const userGroups = UserGroupFactory.all(screenName, listSlugs, twitterClient);

    return userGroups;
  }

  public async exportUserGroup(userGroupPath: UserGroupPath) {
    const userGroup = UserGroupFactory.fromPath(userGroupPath, this.user.screenName, this.twitterClient);
    const users = await userGroup.fetchMembers();
    return JSON.stringify(users, null, '  ');
  }

  public async importUserGroup(userGroupPath: UserGroupPath, json: string) {
    const userGroup = UserGroupFactory.fromPath(userGroupPath, this.user.screenName, this.twitterClient);
    const newUsers = JSON.parse(json);

    const oldUsers = await userGroup.fetchMembers();
    const diff = diffUserList(oldUsers, newUsers);
    await userGroup.patch(diff);
  }
}
