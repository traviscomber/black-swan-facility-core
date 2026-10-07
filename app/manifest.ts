import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Blackswan Facility Core",
    short_name: "BSFC",
    description: "Blackswan Facility Core operational system for people, hospitality, facilities, finance and field work.",
    start_url: "/os",
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
      { name: "Hoy", short_name: "Hoy", description: "Open the Black Swan operating home.", url: "/os" },
      { name: "Mis tareas", short_name: "Tareas", description: "Open assigned operational work.", url: "/my-tasks" },
      { name: "Personal", short_name: "Personal", description: "Open people and daily operations.", url: "/employees" },
      { name: "Reservas", short_name: "Reservas", description: "Open hospitality bookings.", url: "/bookings" },
      { name: "Orchard", short_name: "Orchard", description: "Open Orchard field operations.", url: "/orchard/field" },
    ],
  }
}
