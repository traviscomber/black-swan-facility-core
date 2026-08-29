import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "app.blackswn.facilitycore",
  appName: "Blackswan Facility Core",
  webDir: "www",
  server: {
    url: "https://blackswn.app",
    cleartext: false,
    allowNavigation: ["blackswn.app", "*.blackswn.app"],
  },
  ios: {
    contentInset: "automatic",
    scheme: "Blackswan Facility Core",
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
}

export default config
