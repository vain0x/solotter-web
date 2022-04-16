export interface TwitterUserAuth {
  token: string
  token_secret: string
  screen_name: string
}

export interface TwitterAuth extends TwitterUserAuth {
  consumer_key: string
  consumer_secret: string
}

export interface TwitterConfig {
  callbackUri: string
  adminAuth: TwitterAuth
  userAuth?: TwitterUserAuth
  oauthState?: {
    token: string
    token_secret: string
  }
}

export interface AccessUser {
  userAuth: TwitterUserAuth
}

// export interface AppState {
//   authId: string
//   accessUser: AccessUser | undefined
// }

// export interface TweetState {
//   message: string
//   status: string
// }
