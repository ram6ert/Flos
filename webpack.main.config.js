const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
  entry: "./dist/main/main/index.js",
  target: "electron-main",
  mode: "production",
  output: {
    path: path.resolve(__dirname, "dist/main"),
    filename: "index.min.js",
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true,
          },
          mangle: true,
        },
      }),
    ],
  },
  resolve: {
    extensions: [".js"],
    alias: {
      "../shared/types": path.resolve(__dirname, "dist/main/shared/types"),
    },
  },
  externals: {
    electron: "commonjs electron",
    canvas: "commonjs2 canvas",
    bufferutil: "commonjs bufferutil",
    "utf-8-validate": "commonjs utf-8-validate",
  },
  node: {
    __dirname: false,
    __filename: false,
  },
};
