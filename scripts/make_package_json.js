const fs = require("fs/promises")

!(async () => {
  await fs.mkdir("target", { recursive: true }).catch(() => undefined)
  await fs.writeFile("target/package.json", `{"type": "module"}\n`)
})()
