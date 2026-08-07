import type { Language } from "@/lib/hooks/use-language"

export const extrasCopy: Record<Language, Record<string, string>> = {
  en: {
    title: "Extras and services", subtitle: "Commercial catalog for additional reservation charges.", newExtra: "New extra", activeExtras: "Active extras", catalogTotal: "Catalog total", averagePrice: "Average price", search: "Search extra or service", active: "Active", inactive: "Inactive", all: "All", name: "Name", unit: "Unit", price: "Price", tax: "Tax", status: "Status", actions: "Actions", loading: "Loading catalog...", noResults: "No extras match the selected filters.", noDescription: "No description", description: "Description", cancel: "Cancel", saving: "Saving...", create: "Create extra", deleteConfirm: "Delete {name}?", unitUnit: "Unit", unitNight: "Night", unitPerson: "Person", unitPersonNight: "Person/night", unitStay: "Stay",
  },
  es: {
    title: "Extras y servicios", subtitle: "Catálogo comercial para cargos adicionales en reservas.", newExtra: "Nuevo extra", activeExtras: "Extras activos", catalogTotal: "Total catálogo", averagePrice: "Precio promedio", search: "Buscar extra o servicio", active: "Activo", inactive: "Inactivo", all: "Todos", name: "Nombre", unit: "Unidad", price: "Precio", tax: "IVA", status: "Estado", actions: "Acciones", loading: "Cargando catálogo...", noResults: "No hay extras para los filtros seleccionados.", noDescription: "Sin descripción", description: "Descripción", cancel: "Cancelar", saving: "Guardando...", create: "Crear extra", deleteConfirm: "¿Eliminar {name}?", unitUnit: "Unidad", unitNight: "Noche", unitPerson: "Persona", unitPersonNight: "Persona/noche", unitStay: "Estadía",
  },
  de: {
    title: "Extras und Leistungen", subtitle: "Leistungskatalog für zusätzliche Reservierungsgebühren.", newExtra: "Neues Extra", activeExtras: "Aktive Extras", catalogTotal: "Katalog gesamt", averagePrice: "Durchschnittspreis", search: "Extra oder Leistung suchen", active: "Aktiv", inactive: "Inaktiv", all: "Alle", name: "Name", unit: "Einheit", price: "Preis", tax: "Steuer", status: "Status", actions: "Aktionen", loading: "Katalog wird geladen...", noResults: "Keine Extras entsprechen den gewählten Filtern.", noDescription: "Keine Beschreibung", description: "Beschreibung", cancel: "Abbrechen", saving: "Wird gespeichert...", create: "Extra erstellen", deleteConfirm: "{name} löschen?", unitUnit: "Einheit", unitNight: "Nacht", unitPerson: "Person", unitPersonNight: "Person/Nacht", unitStay: "Aufenthalt",
  },
}

export function fillExtrasCopy(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), template)
}
