import {
  AccessToken,
  TwitterScreenName,
} from 'core/twitter/types';
import { OAuth } from 'oauth';

export interface OAuthToken {
  oauthTokenKey: string;
  oauthTokenSecret: string;
}

interface AuthenticationCallbackRequest {
  oauthToken: OAuthToken;
  redirectURI: string;
}

export interface AuthenticationCallbackResult {
  twitter: {
    accessToken: AccessToken;
    user: {
      screenName: TwitterScreenName,
    };
  };
}

/**
 * Represents a twitter app, not requiring user authentication.
 */
export class TwitterAppAPI {
  private oa: any;

  constructor(
    private readonly accessToken: {
      consumerKey: string,
      consumerSecret: string,
    },
    private readonly callbackURI: string,
  ) {
    this.oa =
      new OAuth(
        'https://twitter.com/oauth/request_token',
        'https://twitter.com/oauth/access_token',
        this.accessToken.consumerKey,
        this.accessToken.consumerSecret,
        '1.0',
        callbackURI,
        'HMAC-SHA1',
      );
  }

  public authenticate() {
    return new Promise<AuthenticationCallbackRequest>((resolve, reject) => {
      this.oa.getOAuthRequestToken((error: Error, oauthTokenKey: string, oauthTokenSecret: string) => {
        if (error) {
          return reject(error);
        }

        const redirectURI = `https://twitter.com/oauth/authenticate?oauth_token=${oauthTokenKey}`;
        const oauthToken = { oauthTokenKey, oauthTokenSecret };
        resolve({ redirectURI, oauthToken });
      });
    });
  }

  public acceptAuthenticationCallback(oauthToken: OAuthToken, oauthVerifier: string) {
    return new Promise<AuthenticationCallbackResult>((resolve, reject) => {
      this.oa.getOAuthAccessToken(
        oauthToken.oauthTokenKey,
        oauthToken.oauthTokenSecret,
        oauthVerifier,
        (error: Error, accessTokenKey: string, accessTokenSecret: string, results: { screen_name: string }) => {
          if (error) {
            return reject(error);
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
                screenName: results.screen_name,
              },
            },
          });
        });
    });
  }
}
