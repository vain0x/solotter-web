import express, { RequestHandler } from "express"
import fsP from "fs/promises"
import path from "path"
import { TwitterUserAuth } from "../types"
import { OAuthService, TwitterApiClient } from "./twitter_api"

export type TwitterServiceFn = (userAuth: TwitterUserAuth) => TwitterApiClient

// Extends req.session type.
declare global {
  namespace CookieSessionInterfaces {
    interface CookieSessionObject {
      auth?: TwitterUserAuth
    }
  }
}

const requireAuth: RequestHandler = (req, res, next) => {
  if (req.session?.auth != null) {
    next()
  } else {
    res.sendStatus(403) // Forbidden.
  }
}

export const serverRouter = (props: {
  staticDir: string
  oauthService: OAuthService
  twitterServiceFn: TwitterServiceFn
}): express.Router => {
  const { staticDir, oauthService, twitterServiceFn } = props

  const router = express.Router()
  const staticFileHandler = express.static(staticDir)

  if (process.env.NODE_ENV === "development") {
    router.use((req, _res, next) => {
      process.stderr.write(`${req.method} ${req.url}\n`)
      next()
    })
  }

  router.get([
    "/favicon.ico",
    "/index.html",
    "/scripts/*",
    "/styles/*",
  ], staticFileHandler)

  router.post("/api/twitter-auth-request", (_req, res, next) => {
    (async () => {
      const { oauth_token: _token, redirect } = await oauthService.oauthRequest()
      res.redirect(redirect)
    })().catch(next)
  })

  router.get("/api/twitter-auth-callback", (req, res, next) => {
    (async () => {
      const { oauth_token, oauth_verifier } = req.query
      if (typeof oauth_token !== "string" || typeof oauth_verifier !== "string") throw new Error()

      const userAuth = await oauthService.oauthCallback({ oauth_token, oauth_verifier })

      req.session = { auth: userAuth }
      res.redirect("/")
    })().catch(next)
  })

  router.post("/api/logout", (req, res, next) => {
    (async () => {
      req.session = null
      res.json({})
    })().catch(next)
  })

  router.post("/api/statuses/update", requireAuth, (req, res, next) => {
    (async () => {
      const { token, token_secret, screen_name } = req.session?.auth ?? {}
      const { status } = req.body
      if (
        typeof token !== "string"
        || typeof token_secret !== "string"
        || typeof screen_name !== "string"
        || typeof status !== "string"
      ) throw new Error()
      const oauth = { token, token_secret, screen_name }

      await twitterServiceFn(oauth)["/statuses/update"]({ status, trim_user: true })
      res.json({})
    })().catch(next)
  })

  router.get("/*", (req, res, next) => {
    (async () => {
      const auth = req.session?.auth
      const data = { auth: auth && { screenName: auth.screen_name } }
      const indexHtml = await fsP.readFile(path.join(staticDir, "index.html"), { encoding: "utf-8" })
      const html = indexHtml.replace("{{ DATA_JSON }}", JSON.stringify(data).replace(/"/g, '&quot;'))
      res.status(200)
      res.setHeader("Cache-Control", "no-store")
      res.setHeader("Content-Type", "text/html")
      res.setHeader("Vary", "*")
      res.send(html)
    })().catch(next)
  })
  return router
}
