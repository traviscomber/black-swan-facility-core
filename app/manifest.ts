import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/orchard/field",
    name: "Blackswan Facility Core",
    short_name: "BSFC",
    description: "Blackswan Facility Core field operations and Orchard management.",
    start_url: "/orchard/field",
    scope: "/",
    display: "standalone",
    background_color: "#171512",
    theme_color: "#171512",
    orientation: "portrait-primary",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      { name: "Orchard Field Mode", short_name: "Field", description: "Open today's Orchard field work.", url: "/orchard/field" },
      { name: "Record Harvest", short_name: "Harvest", description: "Open fast harvest entry.", url: "/orchard/field/harvest" },
      { name: "Nursery", short_name: "Nursery", description: "Update nursery batches.", url: "/orchard/field/nursery" },
      { name: "Crop Care", short_name: "Care", description: "Record crop care.", url: "/orchard/care" },
      { name: "Crop Health", short_name: "Health", description: "Record crop health observations.", url: "/orchard/pests" },
    ],
  }
}
