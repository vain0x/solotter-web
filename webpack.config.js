const path = require('path');

const scriptsDir= path.normalize(__dirname + '/dist/public/scripts');

module.exports = {
  entry: [
    './src/client/app.tsx',
  ],
  output: {
    filename: 'bundle.js',
    path: scriptsDir,
  },

  devtool: 'source-map',

  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json']
  },

  module: {
    rules: [
      { test: /\.tsx?$/, loader: 'ts-loader' },
      { enforce: 'pre', test: /\.js$/, loader: 'source-map-loader' }
    ]
  }
};
