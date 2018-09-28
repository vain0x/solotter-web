export type UserGroupPath = string;
export type TwitterUserId = string;
export type TwitterScreenName = string;

export interface TwitterList {
  slug: string;
}

export interface UserGroupKey {
  type: string;
  ownerScreenName: string;
  slug: string;
}

export interface TwitterUser {
  userId: TwitterUserId;
  screenName: TwitterScreenName;
  name: string;
}

export interface AccessToken {
  consumerKey: string;
  consumerSecret: string;
  accessTokenKey: string;
  accessTokenSecret: string;
}
