import { TwitterUserAuth } from "./types"

export interface ApiSchema {
  "/api/twitter-auth-request": {
    req: { authId: string }
    res: { oauth_token: string }
  }
  "/api/twitter-auth-callback": {
    req: {
      oauth_token: string
      oauth_verifier: string
    }
    res: {}
  }
  "/api/twitter-auth-end": {
    req: { authId: string }
    res: { user: TwitterUserAuth | null }
  }
  "/api/statuses/update": {
    req: {
      userAuth: TwitterUserAuth
      status: string
    }
    res: {}
  }
}

export type SolotterApiServer = {
  [P in keyof ApiSchema]: (req: ApiSchema[P]["req"]) => Promise<ApiSchema[P]["res"]>
}
