import React, { useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"

const SolotterTitle = () => (
  <span style={{ color: "var(--primary-color-light)" }}>Solotter</span>
)

const WelcomeComponent = () => {
  const authIdRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const e = authIdRef.current
    if (e != null) {
      const authId = Math.random().toString().replace(".", "")
      e.value = authId
    }
  }, [])

  return (
    <article className="flex flex-col" id="welcome-component">
      <header>
        <h1>Welcome to <SolotterTitle /></h1>
      </header>

      <main style={{ flex: 1 }}>
        <p>
          <SolotterTitle /> is a twitter client for those who want to stay focused on work.
        </p>

        <form method="POST" action="/api/twitter-auth-request">
          <button className="login-button">Login with Twitter</button>
        </form>
      </main>

      <Footer />
    </article>
  )
}

const TweetComponent = (props: { screenName: string }) => {
  const { screenName } = props
  const [status, setStatus] = useState("")
  const [state, setState] = useState<"success" | "fail" | "busy" | null>(null)

  const [statusToSubmit, setStatusToSubmit] = useState<string>()
  useEffect(() => {
    if (statusToSubmit == null) return
    if (statusToSubmit === "" || statusToSubmit.length > 280) {
      setStatusToSubmit(undefined)
      return
    }

    setState("busy")

    const abortController = new AbortController()
    const signal = abortController.signal
    !(async () => {
      try {
        const res = await fetch("/api/statuses/update", {
          body: JSON.stringify({ status: statusToSubmit }),
          method: "POST",
          headers: { ["Content-Type"]: "application/json" },
          signal,
        })
        if (!res.ok) throw new Error(`Failed. (Status ${res.status})`)

        setStatus("")
        setState("success")
      } catch (err) {
        console.error(err)
        if (!signal.aborted) {
          setState("fail")
        }
      } finally {
        if (!signal.aborted) {
          setStatusToSubmit(undefined)
        }
      }
    })()
    return () => { abortController.abort() }
  })

  useEffect(() => {
    if (state === "success") {
      const h = setTimeout(() => { setState(null) }, 5000)
      return () => { clearTimeout(h) }
    }
  }, [state])

  const message = (() => {
    switch (state) {
      case "success": return "Success!"
      case "fail": return "Sorry, submission didn't succeed."
      case "busy": return "..."
      default: return ""
    }
  })()

  const ready = screenName != null && statusToSubmit == null
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <article id="tweet-component" className="flex flex-col">
      <header>
        <h1>Tweet via <SolotterTitle /></h1>
      </header>

      <main className="flex flex-col" style={{ flex: 1, gap: "1rem" }}>
        <div>
          <strong>{`@${screenName}`}</strong>, what are you doing?
        </div>

        <form
          ref={formRef}
          className="flex flex-col"
          style={{ gap: "1rem" }}
          onSubmit={ev => { ev.preventDefault(); setStatusToSubmit(status.trim()) }}>
          <textarea
            className="tweet-textarea"
            rows={4}
            placeholder="E.g. I'm working!"
            autoFocus
            required maxLength={280}
            readOnly={!ready}
            value={status}
            onChange={ev => setStatus(ev.target.value)}
            onKeyDown={ev => {
              if (ev.altKey || ev.metaKey) return
              if ((ev.ctrlKey || ev.shiftKey) && ev.key === "Enter") {
                ev.preventDefault()
                formRef.current?.requestSubmit()
              }
            }} />

          <button className="tweet-button" disabled={!ready || !status}>
            Submit
          </button>

          <div className="tweet-message" hidden={!message}
            data-bad={state === "fail" ? true : undefined}
            style={{ alignSelf: "start", minWidth: "20rem" }}>
            {message}
          </div>
        </form>
      </main>

      <aside style={{ position: "absolute", top: "1rem", right: "1rem" }}>
        <LogoutButton />
      </aside>

      <Footer />
    </article>
  )
}

const LogoutButton = () => {
  return (
    <button type="button"
      style={{ padding: "0.5rem 1rem", border: "1px solid #bdbdbd", background: "white", fontSize: "1rem" }}
      onClick={() => {
        (async () => {
          const res = await fetch("/api/logout", { method: "POST" })
          if (res.ok) document.location.reload()
        })()
      }}>
      Logout
    </button>
  )
}

const Footer = () => {
  return (
    <footer style={{ marginTop: "auto", display: "flex", justifyContent: "flex-end", padding: "0.5rem 1rem" }}>
      <a href="https://github.com/vain0x/solotter-web" style={{ textDecoration: "none", color: "#737373", fontSize: "1rem" }}>@vain0x/solotter-web on GitHub</a>
    </footer>
  )
}

export const startClient = () => {
  // Load the data from server.
  let loggedIn = false
  let screenName = ""
  try {
    const json = document.getElementById("data-script")?.getAttribute("data-json")!
    const data = JSON.parse(json)
    if (data?.auth != null) {
      loggedIn = true
      screenName = data.auth.screenName!
    }
  } catch (err) {
    console.error(err)
  }

  const appRoot = createRoot(document.getElementById("app-root")!)
  appRoot.render((
    !loggedIn
      ? (<WelcomeComponent />)
      : (<TweetComponent screenName={screenName} />)
  ))
}
