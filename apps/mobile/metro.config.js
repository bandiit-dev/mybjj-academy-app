const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

const reactPath = path.dirname(require.resolve("react/package.json", { paths: [projectRoot] }));
const reactNativePath = path.dirname(require.resolve("react-native/package.json", { paths: [projectRoot] }));

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules")
];

config.resolver.extraNodeModules = {
  react: reactPath,
  "react/jsx-runtime": path.join(reactPath, "jsx-runtime.js"),
  "react/jsx-dev-runtime": path.join(reactPath, "jsx-dev-runtime.js"),
  "react-native": reactNativePath
};

module.exports = withNativeWind(config, {
  input: "./global.css"
});
