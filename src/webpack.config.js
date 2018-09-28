const path = require('path');
const webpack = require('webpack');

const isProductionEnv = process.env.NODE_ENV === 'production';
const isDevelopmentEnv = process.env.NODE_ENV == 'development';

const config = {
  entry: {
    'client/index': './client/index.ts',
    'client/index.spec': './client/index.spec.ts',
  },
  output: {
    path: path.resolve(__dirname, '../dist'),
    publicPath: '/',
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /(\.js|\.ts)$/,
        exclude: /(node_modules|bower_components)/,
        use: [
          {
            loader: 'ifdef-loader',
            options: {
              PRODUCTION: isProductionEnv,
              DEVELOPMENT: isDevelopmentEnv,
              TESTING: isDevelopmentEnv,
            },
          },
        ],
      },
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: {
          loaders: {
            'scss': 'vue-style-loader!css-loader!sass-loader',
          },
        },
      },
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
        options: {
          configFile: 'tsconfig-client.json',
          appendTsSuffixTo: [/\.vue$/],
        },
      },
      {
        test: /\.css$/,
        use: [
          { loader: 'style-loader' },
          { loader: 'css-loader' },
        ],
      },
      {
        test: /\.scss$/,
        use: [
          {
            loader: 'style-loader',
          },
          {
            loader: 'css-loader',
          },
          {
            loader: 'sass-loader',
            options: {
              includePaths: ['./client/styles'],
            },
          },
        ],
      },
      {
        test: /\.(png|jpg|gif|svg)$/,
        loader: 'file-loader',
        options: {
          name: '[name].[ext]?[hash]',
        },
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js', '.vue', '.json'],
    alias: {
      'vue$': 'vue/dist/vue.esm.js',
    },
  },
  devServer: {
    port: 8080,
    publicPath: 'http://127.0.0.1:8080/',
    contentBase: path.normalize(path.join(__dirname, '..', 'dist', 'client')),
    proxy: {
      '/auth': 'http://127.0.0.1:8081',
      '/api': 'http://127.0.0.1:8081',
      '/tweet': 'http://127.0.0.1:8081',
      '/user-group': 'http://127.0.0.1:8081',
      '/': 'http://127.0.0.1:8081',
    },
    hot: true,
    overlay: true,
    historyApiFallback: true,
    noInfo: true,
  },
  performance: {
    hints: false,
  },
};

if (process.env.NODE_ENV === 'development') {
  config.devtool = '#eval-source-map';
  config.plugins = (config.plugins || []).concat([
    new webpack.NamedModulesPlugin(),
    new webpack.HotModuleReplacementPlugin(),
  ]);
} else if (process.env.NODE_ENV === 'production') {
  config.devtool = '#source-map';

  // http://vue-loader.vuejs.org/en/workflow/production.html
  config.plugins = (config.plugins || []).concat([
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: '"production"',
      },
    }),
    new webpack.LoaderOptionsPlugin({
      minimize: true,
    }),
  ]);
} else {
  throw new Error(`Unknown NODE_ENV: ${process.env.NODE_ENV}`);
}

module.exports = config;
