import { ExpoConfig, ConfigContext } from "expo/config";

const APP_IDENTIFIERS = {
  bundleIdentifier: "io.casecurrent.app",
  package: "io.casecurrent.app",
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "CaseCurrent",
  slug: "casecurrent",
  scheme: "casecurrent",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#111827",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: APP_IDENTIFIERS.bundleIdentifier,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#111827",
    },
    package: APP_IDENTIFIERS.package,
  },
  plugins: ["expo-secure-store", "expo-notifications"],
  owner: "casecurrentai",
  extra: {
    eas: {
      projectId: "2405bb62-0ed9-4a59-a1ac-2c807c1309d3",
    },
  },
});
