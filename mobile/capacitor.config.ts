import type { CapacitorConfig } from "@capacitor/cli";

const appUrl = String(process.env.CAP_APP_URL || "").trim();
const hasRemoteUrl = appUrl.startsWith("https://") || appUrl.startsWith("http://");

const serverConfig: NonNullable<CapacitorConfig["server"]> = {
  androidScheme: "http"
};

if (hasRemoteUrl) {
  serverConfig.url = appUrl;
  serverConfig.cleartext = appUrl.startsWith("http://");
}

const config: CapacitorConfig = {
  appId: "com.criczone.app",
  appName: "CricZone",
  webDir: "../public",
  bundledWebRuntime: false,
  server: serverConfig
};

export default config;
