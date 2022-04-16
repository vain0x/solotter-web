import cookieSession from "cookie-session"
import express from "express"
import path from "path"
import { envOrConfig, readConfigFile } from "./config"
import { serverRouter, TwitterServiceFn } from "./server_router"
import { oauthClientWith, oauthServiceWith, TwitterApiClient } from "./twitter_api"

const ROOT = process.cwd()
const ENV_FILE = path.join(ROOT, ".env")
const STATIC_DIR = path.join(ROOT, "static")

// const parseAuthHeader = (a: string | undefined): string | undefined => {
//   const s = a && a.split(" ") || []
//   return s[0] === "Bearer" && s[1] || undefined
// }
// parseAuthHeader(req.headers.authorization)

export const startServer = async () => {
  const env = envOrConfig(await readConfigFile(ENV_FILE))
  const host = env.getOr("HOST", "localhost")
  const port = +(env.getOr("PORT", "8080"))
  const COOKIE_SECRET = env.get("COOKIE_SECRET")

  const twitterConfig = {
    callbackUri: env.get("TWITTER_OAUTH_CALLBACK_URI"),
    adminAuth: {
      consumer_key: env.get("TWITTER_CONSUMER_KEY"),
      consumer_secret: env.get("TWITTER_CONSUMER_SECRET"),
      token: env.get("TWITTER_ACCESS_TOKEN"),
      token_secret: env.get("TWITTER_ACCESS_TOKEN_SECRET"),
      screen_name: env.get("TWITTER_ADMIN_SCREEN_NAME"),
    },
  }

  const oauthClient = oauthClientWith(twitterConfig)
  const oauthService = oauthServiceWith(oauthClient)
  const twitterServiceFn: TwitterServiceFn = userAuth =>
    new TwitterApiClient({ ...twitterConfig, userAuth })

  const app = express()
  app.use(cookieSession({ secret: COOKIE_SECRET }))
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(serverRouter({ staticDir: STATIC_DIR, oauthService, twitterServiceFn }))

  const server = app.listen(port, () => {
    process.stdout.write(
      "Server started.\n"
      + `  static: ${STATIC_DIR}\n`
      + `  url: http://${host}:${port}\n`
    )
  })

  {
    const onSignal = (signal: number): void => {
      server.close()
      process.off("SIGINT", onSignal)
      process.off("SIGTERM", onSignal)
      process.kill(process.pid, signal)
    }
    process.once("SIGINT", onSignal)
    process.once("SIGTERM", onSignal)
  }
}

startServer().catch(err => {
  process.stderr.write(`ERROR: ${err}`)
  process.kill(process.pid, "SIGTERM")
})
