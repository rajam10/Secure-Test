const path = require("path");

module.exports = {
  entry: "./src/index.jsx",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
    publicPath: "/"
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-react"]
          }
        }
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"]
      }
    ]
  },
  resolve: {
    extensions: [".js", ".jsx"]
  },

  devServer: {
    static: {
      directory: path.join(__dirname, "public")
    },
    historyApiFallback: true,
    port: 3000,

    proxy: [
      {
        context: ["/api"],
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false
      }
    ]
  }
};
