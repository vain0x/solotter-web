const path = require("path")

const SCRIPTS_DIR = path.join(__dirname, "dist/public/scripts")

module.exports = {
  context: __dirname,
  entry: [
    "./src/client/app.tsx",
  ],
  output: {
    filename: "bundle.js",
    path: SCRIPTS_DIR,
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      { test: /\.tsx?$/, loader: "ts-loader" },
    ],
  },
}
