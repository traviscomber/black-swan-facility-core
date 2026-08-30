"use client"

import Link from "next/link"
import { AlertTriangle, Fuel, Gauge, PlugZap, ShieldCheck } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EnergyPasswordGuard } from "@/components/energy-password-guard"
import { useLanguage } from "@/lib/hooks/use-language"

const copy = {
  es: {
    title: "Energía y sistemas eléctricos",
    description: "Estado de integración energética de Fundo Corcovado y acceso a los registros operativos disponibles.",
    statusTitle: "Telemetría energética aún no conectada",
    statusBody: "La base productiva no contiene actualmente tablas de paneles solares, consumo por edificio ni dispositivos Victron. La interfaz anterior consultaba estructuras inexistentes y podía mostrar una operación vacía como si estuviera configurada.",
    available: "Disponible",
    unavailable: "No conectado",
    fuelTitle: "Consumo de combustibles",
    fuelBody: "Existe información operativa real de consumo, vehículos, resúmenes mensuales y anomalías. Esta es la fuente energética disponible actualmente.",
    openFuel: "Abrir combustibles",
    telemetryTitle: "Telemetría solar y eléctrica",
    telemetryBody: "No existen fuentes productivas para generación solar, demanda por edificio, baterías, inversores o controladores de carga.",
    integrationTitle: "Requisitos para habilitar la integración",
    integrationBody: "La futura conexión debe definir equipos reales, identificadores Victron VRM, edificios asociados, unidades de medida, frecuencia de lectura, retención histórica y responsables de validación.",
    safeguardTitle: "Criterio operativo",
    safeguardBody: "No se mostrarán capacidades, producción, consumo ni porcentajes de compensación solar hasta que provengan de equipos o registros verificables.",
  },
  en: {
    title: "Energy and electrical systems",
    description: "Energy integration status for Fundo Corcovado and access to the operational records currently available.",
    statusTitle: "Energy telemetry is not connected yet",
    statusBody: "The production database currently has no tables for solar panels, building consumption or Victron devices. The previous interface queried structures that do not exist and could present an empty operation as if it were configured.",
    available: "Available",
    unavailable: "Not connected",
    fuelTitle: "Fuel consumption",
    fuelBody: "Real operational data exists for consumption, vehicles, monthly summaries and anomalies. This is the energy source currently available in the system.",
    openFuel: "Open fuel records",
    telemetryTitle: "Solar and electrical telemetry",
    telemetryBody: "There are no production sources for solar generation, building demand, batteries, inverters or charge controllers.",
    integrationTitle: "Requirements to enable integration",
    integrationBody: "A future connection must define real equipment, Victron VRM identifiers, associated buildings, measurement units, reading frequency, historical retention and validation owners.",
    safeguardTitle: "Operational standard",
    safeguardBody: "Capacity, production, consumption and solar-offset percentages will not be displayed until they come from verifiable equipment or records.",
  },
  de: {
    title: "Energie und elektrische Systeme",
    description: "Status der Energieintegration auf Fundo Corcovado und Zugriff auf die derzeit verfügbaren Betriebsdaten.",
    statusTitle: "Energietelemetrie ist noch nicht verbunden",
    statusBody: "Die Produktionsdatenbank enthält derzeit keine Tabellen für Solarmodule, Gebäudeverbrauch oder Victron-Geräte. Die frühere Oberfläche fragte nicht vorhandene Strukturen ab und konnte einen leeren Betrieb so darstellen, als wäre er konfiguriert.",
    available: "Verfügbar",
    unavailable: "Nicht verbunden",
    fuelTitle: "Kraftstoffverbrauch",
    fuelBody: "Für Verbrauch, Fahrzeuge, Monatsübersichten und Anomalien liegen reale Betriebsdaten vor. Dies ist derzeit die verfügbare Energiequelle im System.",
    openFuel: "Kraftstoffdaten öffnen",
    telemetryTitle: "Solar- und Stromtelemetrie",
    telemetryBody: "Es gibt keine produktiven Datenquellen für Solarerzeugung, Gebäudelast, Batterien, Wechselrichter oder Laderegler.",
    integrationTitle: "Voraussetzungen für die Integration",
    integrationBody: "Eine künftige Anbindung muss reale Geräte, Victron-VRM-Kennungen, zugeordnete Gebäude, Maßeinheiten, Abfragefrequenz, historische Aufbewahrung und Verantwortliche für die Validierung definieren.",
    safeguardTitle: "Betriebsgrundsatz",
    safeguardBody: "Kapazität, Produktion, Verbrauch und Solarabdeckungsanteile werden erst angezeigt, wenn sie aus überprüfbaren Geräten oder Datensätzen stammen.",
  },
} as const

export default function EnergyManagementPage() {
  const { language } = useLanguage()
  const text = copy[language]

  return (
    <EnergyPasswordGuard>
      <AppLayout>
        <PageHeader title={text.title} description={text.description} icon={PlugZap} />
        <div className="space-y-6 p-4 sm:p-8">
          <Card className="border-amber-300">
            <CardContent className="flex gap-3 p-5">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">{text.statusTitle}</p>
                <p className="mt-1 text-sm text-muted-foreground">{text.statusBody}</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2"><Fuel className="h-5 w-5" /><CardTitle className="text-base">{text.fuelTitle}</CardTitle></div>
                  <Badge variant="outline">{text.available}</Badge>
                </div>
                <CardDescription>{text.fuelBody}</CardDescription>
              </CardHeader>
              <CardContent><Button asChild><Link href="/combustibles">{text.openFuel}</Link></Button></CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2"><Gauge className="h-5 w-5" /><CardTitle className="text-base">{text.telemetryTitle}</CardTitle></div>
                  <Badge variant="secondary">{text.unavailable}</Badge>
                </div>
                <CardDescription>{text.telemetryBody}</CardDescription>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">{text.integrationTitle}</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{text.integrationBody}</p></CardContent>
            </Card>
            <Card>
              <CardHeader><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /><CardTitle className="text-base">{text.safeguardTitle}</CardTitle></div></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{text.safeguardBody}</p></CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    </EnergyPasswordGuard>
  )
}
