
const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  entry: "./src/index.js",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
  },
  devtool: "inline-source-map",
  devServer: {
    contentBase: "./dist",
    watchContentBase: true
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [ "style-loader", "css-loader" ]
      },
      {
        test: /\.(png|svg|jpg|gif)$/,
        use: [ "file-loader" ]
      },
      {
        test: /\.xsd$/,
        use: [ "xml-loader" ]
      },
      {
        test: require.resolve("jquery"),
        use: [
          {loader: "expose-loader", options: "$"},
          {loader: "expose-loader", options: "jQuery"}
        ]
      },
    ]
  },
  // externals: {
  //   jquery: "jQuery"
  // },
  plugins: [
    new HtmlWebpackPlugin({

    })
    // new webpack.ProvidePlugin({
    //   $: "jquery",
    //   jQuery: "jquery",
    //   SaxonJS: ""
    // }),
  ],
  // externals: {
  //   SaxonJS
  // }
};
