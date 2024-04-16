const path = require('path')

module.exports = {
  entry: {
    main: './src/header-validator/index.ts',
    'filters-main': './src/header-validator/filters-index.ts',
  },
  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: [
          {
            loader: 'ts-loader',
            options: { onlyCompileBundledFiles: true },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist', 'header-validator'),
  },
}
