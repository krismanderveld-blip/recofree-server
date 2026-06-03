module.exports = function (api) {
  api.cache(true);
  let plugins = [];

  // react-native-reanimated/plugin includes worklets support in Reanimated 4.x
  // MUST be last plugin — required for Android production builds
  plugins.push("react-native-reanimated/plugin");

  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    plugins,
  };
};
