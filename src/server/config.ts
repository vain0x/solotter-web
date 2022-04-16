import fs from "node:fs/promises"

export const readConfigFile = async (pathname: string): Promise<Record<string, string | undefined>> => {
  const text = await fs.readFile(pathname, { encoding: "utf-8" })
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

export const envOrConfig = (config: Record<string, string | undefined>): {
  get: (key: string) => string
  getOr: (key: string, alt: string) => string
} => ({
  get: (key: string) => {
    const value = process.env[key] || config[key]
    if (!value) throw new Error(`Environment variable ${key} is unspecified or empty.`)
    return value
  },
  getOr: (key: string, alt: string): string => process.env[key] || config[key] || alt,
})
