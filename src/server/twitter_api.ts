import crypto from "node:crypto"
import request from "request-promise-native"
import { OAuth } from "oauth"
import { TwitterConfig, TwitterUserAuth } from "../types"
import { unreachable } from "../util/error"

const USER_AGENT = "solotter-web"
const REST_API_BASE = "https://api.twitter.com/1.1"
const REST_API_AUTH = "https://twitter.com/oauth/authenticate"
const TIMEOUT = 3 * 3600 * 1000 // 3 hours

interface OAuthParams {
  consumer_key: string
  consumer_secret: string
  token: string
  token_secret: string
}

interface TwitterApi {
  "/statuses/show": {
    method: "GET"
    query: {
      id: string
    }
    response: {}
  }
  "/statuses/update": {
    method: "POST"
    body: {
      status: string
      in_reply_to_status_id?: string
      trim_user: true
    }
    res: {}
  }
}

interface OAuthCallbackParams {
  oauth_token: string
  oauth_verifier: string
}

type OAuthClientCallback = (err: any, token: string, token_secret: string, result?: unknown) => void

interface OAuthClient {
  getOAuthRequestToken(callback: OAuthClientCallback): void

  getOAuthAccessToken(
    oauth_token: string,
    oauth_token_secret: string,
    oauth_verifier: string,
    callback: OAuthClientCallback,
  ): void
}

export interface OAuthService {
  oauthRequest(): Promise<{ oauth_token: string, redirect: string }>
  oauthCallback(params: OAuthCallbackParams): Promise<TwitterUserAuth>
}

export const oauthClientWith = (twitterConfig: TwitterConfig): OAuthClient =>
  new OAuth(
    "https://twitter.com/oauth/request_token",
    "https://twitter.com/oauth/access_token",
    twitterConfig.adminAuth.consumer_key,
    twitterConfig.adminAuth.consumer_secret,
    "1.0",
    twitterConfig.callbackUri,
    "HMAC-SHA1",
  )

export const oauthClientMock = (): OAuthClient => {
  const map = new Map<string, string>()
  const fresh = () => crypto.randomBytes(16).toString("hex")

  return {
    getOAuthRequestToken(callback: OAuthClientCallback): void {
      const token = fresh()
      const token_secret = fresh()
      map.set(token, token_secret)
      callback(undefined, token, token_secret)
    },
    getOAuthAccessToken(
      oauth_token: string,
      oauth_token_secret: string,
      _oauth_verifier: string,
      callback: OAuthClientCallback,
    ): void {
      const token_secret = map.get(oauth_token)
      if (token_secret !== oauth_token_secret) throw new Error("Failed.")
      map.delete(oauth_token)
      callback(undefined, oauth_token, oauth_token_secret, { screen_name: "john_doe" })
    },
  }
}

export const oauthServiceWith =
  (oauthClient: OAuthClient): OAuthService => {
    // token -> token_secret
    const tokenSecretMap = new Map<string, string>()

    return {
      /** Called after the user requested to be authenticated. */
      oauthRequest: () =>
        new Promise<{ oauth_token: string, redirect: string }>((resolve, reject) => {
          oauthClient.getOAuthRequestToken((err, token, token_secret) => {
            if (err) return reject(err)

            const redirectUrl = `${REST_API_AUTH}?oauth_token=${token}`

            // Save secret data internally.
            tokenSecretMap.set(token, token_secret)
            setTimeout(() => { tokenSecretMap.delete(token) }, TIMEOUT)

            resolve({ oauth_token: token, redirect: redirectUrl })
          })
        }),
      /** Called after the twitter redirected to the callback api. */
      oauthCallback: (params: OAuthCallbackParams) =>
        new Promise<TwitterUserAuth>((resolve, reject) => {
          const { oauth_token: token, oauth_verifier: verifier } = params

          const token_secret = tokenSecretMap.get(token)
          tokenSecretMap.delete(token)
          if (!token_secret) return reject(new Error("Invalid auth flow."))

          oauthClient.getOAuthAccessToken(token, token_secret, verifier,
            (err, token, token_secret, results) => {
              if (err) return reject(err)

              const { screen_name } = results as any
              if (!screen_name) return reject(new Error("screen_name not provided"))

              resolve({ token, token_secret, screen_name })
            })
        }),
    }
  }

const headers: Record<string, string> = {
  Accept: "*/*",
  Connection: "close",
  "User-Agent": USER_AGENT,
}

export class TwitterApiClient {
  #config: TwitterConfig
  #userAuth: TwitterUserAuth

  constructor(config: TwitterConfig) {
    this.#userAuth = config.userAuth ?? unreachable()
    this.#config = config
  }

  private oauth(): OAuthParams {
    const { consumer_key, consumer_secret } = this.#config.adminAuth
    const { token, token_secret } = this.#userAuth
    return { consumer_key, consumer_secret, token, token_secret }
  }

  async "/statuses/update"(body: TwitterApi["/statuses/update"]["body"]): Promise<TwitterApi["/statuses/update"]["res"]> {
    const url = `/statuses/update.json`
    return await request.post(url, {
      baseUrl: REST_API_BASE,
      json: true,
      headers,
      oauth: this.oauth(),
      qs: body,
    })
  }
}
