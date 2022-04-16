const path = require("path")

const SCRIPTS_DIR = path.join(__dirname, "static/scripts")

module.exports = {
  context: __dirname,
  entry: [
    "./src/client/client_main.ts",
  ],
  output: {
    filename: "main.js",
    path: SCRIPTS_DIR,
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
  },
  module: {
    rules: [
      { test: /\.tsx?$/, loader: "ts-loader" },
    ],
  },
}
