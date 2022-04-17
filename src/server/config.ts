import fs from "node:fs/promises"

/** Reads a file to parse a configuration. (`KEY=VALUE` syntax.) */
export const readConfigFile = async (pathname: string): Promise<Record<string, string | undefined>> => {
  let text: string
  try {
    text = await fs.readFile(pathname, { encoding: "utf-8" })
  } catch (err: any) {
    if (err.code === "ENOENT") return {}
    throw err
  }
  const entries: [string, string][] = []
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("#")) continue
    const i = line.indexOf("=")
    if (i < 0) continue
    const key = line.slice(0, i).trim()
    const value = line.slice(i + 1).trim()
    entries.push([key, value])
  }
  return Object.fromEntries(entries)
}

/**
 * Wraps a configuration object for shorter code.
 *
 * - Values are overridden by `process.env`.
 */
export const envOrConfig = (config: Record<string, string | undefined>): {
  /** Gets a value. Error if unspecified or empty. */
  get: (key: string) => string
  /** Gets a value or alternative value if unspecified or empty. */
  getOr: (key: string, alt: string) => string
} => ({
  get: (key: string) => {
    const value = process.env[key] || config[key]
    if (!value) throw new Error(`Environment variable ${key} is unspecified or empty.`)
    return value
  },
  getOr: (key: string, alt: string): string => process.env[key] || config[key] || alt,
})
