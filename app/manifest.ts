import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Blackswan Facility Core",
    short_name: "BSFC",
    description: "Blackswan Facility Core field operations and Orchard management.",
    start_url: "/orchard/field",
    display: "standalone",
    background_color: "#171512",
    theme_color: "#171512",
    orientation: "portrait-primary",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  }
}
