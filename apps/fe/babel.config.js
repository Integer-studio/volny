module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // Required even though this app's own code never imports reanimated:
    // nativewind's runtime (react-native-css-interop) has a hard (non-
    // optional) peerDependency on it, so its worklets need this transform.
    plugins: [
      "react-native-reanimated/plugin",
    ],
  };
};
