"use client"

import { useState } from "react"
import { EnergyPasswordGuard } from "@/components/energy-password-guard"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/lib/hooks/use-language"
import { Check, AlertCircle, Copy, ArrowRight } from "lucide-react"

const COPY = {
  en: { title: "Victron setup guide", description: "Complete integration and configuration steps", architecture: "System architecture", architectureDetail: "Data flow from Victron hardware to cloud and dashboards", scriptTitle: "Python VRM API client", scriptDetail: "Example script for fetching data from Victron VRM", scriptIntro: "Run this script on any system with Python 3.7+ to continuously fetch and log data from your Victron installation via the VRM API.", copied: "Copied", copy: "Copy", install: "Install required package", troubleshooting: "Troubleshooting", troubleshootingDetail: "Common issues and solutions", mqttQuestion: "MQTT not connecting?", mqttAnswer: "Verify dbus-mqtt is enabled in Cerbo GX settings. Check that the firewall allows port 1883. Use mosquitto_sub to test connectivity.", apiQuestion: "VRM API returning 401 errors?", apiAnswer: "Verify that the API token is valid and has not expired. Check the Authorization header format.", grafanaQuestion: "Grafana not showing data?", grafanaAnswer: "Ensure the InfluxDB data source is configured correctly. Verify Node-RED is writing data to InfluxDB and check InfluxDB logs for errors.", historyQuestion: "Missing data points in historical view?", historyAnswer: "Data retention depends on the InfluxDB configuration. Review the retention policy and consider a 30-day policy for monthly reports." },
  es: { title: "Guía de configuración Victron", description: "Pasos completos de integración y configuración", architecture: "Arquitectura del sistema", architectureDetail: "Flujo de datos desde el hardware Victron hasta la nube y los tableros", scriptTitle: "Cliente Python para VRM API", scriptDetail: "Script de ejemplo para obtener datos desde Victron VRM", scriptIntro: "Ejecuta este script en cualquier sistema con Python 3.7+ para obtener y registrar continuamente datos de la instalación Victron mediante VRM API.", copied: "Copiado", copy: "Copiar", install: "Instala el paquete requerido", troubleshooting: "Resolución de problemas", troubleshootingDetail: "Problemas frecuentes y sus soluciones", mqttQuestion: "¿MQTT no conecta?", mqttAnswer: "Verifica que dbus-mqtt esté habilitado en la configuración de Cerbo GX. Revisa que el firewall permita el puerto 1883 y usa mosquitto_sub para probar conectividad.", apiQuestion: "¿VRM API responde con errores 401?", apiAnswer: "Verifica que el token API sea válido y no haya expirado. Revisa el formato del encabezado Authorization.", grafanaQuestion: "¿Grafana no muestra datos?", grafanaAnswer: "Confirma que la fuente de datos InfluxDB esté configurada correctamente. Verifica que Node-RED esté escribiendo en InfluxDB y revisa los logs de InfluxDB.", historyQuestion: "¿Faltan puntos de datos en la vista histórica?", historyAnswer: "La retención depende de la configuración de InfluxDB. Revisa la política de retención y considera 30 días para reportes mensuales." },
  de: { title: "Victron-Einrichtungsleitfaden", description: "Vollständige Integrations- und Konfigurationsschritte", architecture: "Systemarchitektur", architectureDetail: "Datenfluss von der Victron-Hardware bis zur Cloud und zu Dashboards", scriptTitle: "Python-Client für die VRM API", scriptDetail: "Beispielskript zum Abrufen von Daten aus Victron VRM", scriptIntro: "Führe dieses Skript auf einem System mit Python 3.7+ aus, um Daten der Victron-Installation kontinuierlich über die VRM API abzurufen und zu protokollieren.", copied: "Kopiert", copy: "Kopieren", install: "Erforderliches Paket installieren", troubleshooting: "Fehlerbehebung", troubleshootingDetail: "Häufige Probleme und Lösungen", mqttQuestion: "MQTT verbindet sich nicht?", mqttAnswer: "Prüfe, ob dbus-mqtt in den Cerbo-GX-Einstellungen aktiviert ist. Stelle sicher, dass Port 1883 durch die Firewall erlaubt ist, und teste die Verbindung mit mosquitto_sub.", apiQuestion: "VRM API liefert 401-Fehler?", apiAnswer: "Prüfe, ob das API-Token gültig und nicht abgelaufen ist. Kontrolliere das Format des Authorization-Headers.", grafanaQuestion: "Grafana zeigt keine Daten?", grafanaAnswer: "Stelle sicher, dass die InfluxDB-Datenquelle korrekt konfiguriert ist. Prüfe, ob Node-RED Daten in InfluxDB schreibt, und kontrolliere die InfluxDB-Logs.", historyQuestion: "Fehlen Datenpunkte in der historischen Ansicht?", historyAnswer: "Die Datenaufbewahrung hängt von der InfluxDB-Konfiguration ab. Prüfe die Aufbewahrungsrichtlinie und erwäge 30 Tage für Monatsberichte." },
} as const
const STEPS = {
  en: [
    ["Enable VRM Portal & Generate API Token", "Register your Cerbo GX on Victron's cloud platform", ["Create account at https://vrm.victronenergy.com", "Link your Cerbo GX installation", "Navigate to Settings → API Access", "Click Generate Token", "Copy and save your API token securely"]],
    ["Configure MQTT on Cerbo GX", "Enable real-time data streaming", ["Access Cerbo GX web interface (http://<cerbo-ip>)", "Go to Settings → Services → dbus-mqtt", "Enable dbus-mqtt service", "Set MQTT broker (default: 127.0.0.1:1883)", "Optionally configure authentication"]],
    ["Set up Node-RED integration", "Process data from Cerbo GX", ["Cerbo GX comes with Node-RED pre-installed", "Access at http://<cerbo-ip>:1880", "Create MQTT input node connected to Cerbo broker", "Add JSON parsing and filtering nodes", "Connect to InfluxDB or local data store"]],
    ["Deploy monitoring stack", "Store and visualize data", ["Run Docker Compose (InfluxDB + Grafana)", "Import pre-built dashboards", "Configure Grafana data source to InfluxDB", "Set up alert rules for critical values", "Access dashboard at http://localhost:3000"]],
    ["Verify system integration", "Test all data flows", ["Check MQTT topics receiving data", "Verify InfluxDB has historical data", "Confirm Grafana dashboard displays values", "Test alert notifications", "Monitor system performance"]],
  ],
  es: [
    ["Habilitar VRM Portal y generar token API", "Registra Cerbo GX en la plataforma cloud de Victron", ["Crear una cuenta en https://vrm.victronenergy.com", "Vincular la instalación Cerbo GX", "Ir a Settings → API Access", "Seleccionar Generate Token", "Copiar y guardar el token API de forma segura"]],
    ["Configurar MQTT en Cerbo GX", "Habilita el streaming de datos en tiempo real", ["Acceder a la interfaz web de Cerbo GX (http://<cerbo-ip>)", "Ir a Settings → Services → dbus-mqtt", "Habilitar el servicio dbus-mqtt", "Configurar el broker MQTT (por defecto: 127.0.0.1:1883)", "Configurar autenticación si corresponde"]],
    ["Configurar integración Node-RED", "Procesa los datos provenientes de Cerbo GX", ["Cerbo GX incluye Node-RED preinstalado", "Acceder en http://<cerbo-ip>:1880", "Crear un nodo de entrada MQTT conectado al broker de Cerbo", "Agregar nodos de parseo JSON y filtrado", "Conectar a InfluxDB o almacenamiento local"]],
    ["Desplegar stack de monitoreo", "Almacena y visualiza los datos", ["Ejecutar Docker Compose (InfluxDB + Grafana)", "Importar dashboards preconfigurados", "Configurar InfluxDB como fuente de datos en Grafana", "Definir reglas de alerta para valores críticos", "Acceder al dashboard en http://localhost:3000"]],
    ["Verificar integración del sistema", "Prueba todos los flujos de datos", ["Comprobar recepción de datos en los tópicos MQTT", "Verificar datos históricos en InfluxDB", "Confirmar valores en el dashboard de Grafana", "Probar notificaciones de alerta", "Monitorear rendimiento del sistema"]],
  ],
  de: [
    ["VRM Portal aktivieren und API-Token erzeugen", "Cerbo GX auf der Victron-Cloud-Plattform registrieren", ["Konto unter https://vrm.victronenergy.com erstellen", "Cerbo-GX-Installation verknüpfen", "Zu Settings → API Access wechseln", "Generate Token auswählen", "API-Token sicher kopieren und speichern"]],
    ["MQTT auf Cerbo GX konfigurieren", "Echtzeit-Datenstreaming aktivieren", ["Cerbo-GX-Weboberfläche öffnen (http://<cerbo-ip>)", "Zu Settings → Services → dbus-mqtt wechseln", "dbus-mqtt-Dienst aktivieren", "MQTT-Broker setzen (Standard: 127.0.0.1:1883)", "Optional Authentifizierung konfigurieren"]],
    ["Node-RED-Integration einrichten", "Daten vom Cerbo GX verarbeiten", ["Cerbo GX enthält Node-RED vorinstalliert", "Unter http://<cerbo-ip>:1880 öffnen", "MQTT-Eingangsknoten mit dem Cerbo-Broker verbinden", "JSON-Parsing- und Filterknoten hinzufügen", "Mit InfluxDB oder lokalem Datenspeicher verbinden"]],
    ["Monitoring-Stack bereitstellen", "Daten speichern und visualisieren", ["Docker Compose (InfluxDB + Grafana) ausführen", "Vorgefertigte Dashboards importieren", "InfluxDB als Grafana-Datenquelle konfigurieren", "Alarmregeln für kritische Werte einrichten", "Dashboard unter http://localhost:3000 öffnen"]],
    ["Systemintegration prüfen", "Alle Datenflüsse testen", ["Eingehende Daten in MQTT-Topics prüfen", "Historische Daten in InfluxDB prüfen", "Werte im Grafana-Dashboard bestätigen", "Alarmbenachrichtigungen testen", "Systemleistung überwachen"]],
  ],
} as const

const pythonScript = `#!/usr/bin/env python3
# VRM API Data Fetcher - Runs on your Cerbo GX or local server
import requests
import json
from datetime import datetime, timedelta
import time
VRM_ENDPOINT = "https://vrmapi.victronenergy.com/v2"
INSTALLATION_ID = "YOUR_INSTALLATION_ID"
API_TOKEN = "YOUR_API_TOKEN"
POLL_INTERVAL = 300
headers = {"X-Authorization": f"Bearer {API_TOKEN}", "Content-Type": "application/json"}
def fetch_device_data():
    try:
        response = requests.get(f"{VRM_ENDPOINT}/installations/{INSTALLATION_ID}/devices", headers=headers, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching device data: {e}")
        return None
`

export default function VictronSetup() {
  const { language } = useLanguage(); const lang = (language in COPY ? language : "en") as keyof typeof COPY; const copy = COPY[lang]; const steps = STEPS[lang]
  const [activeStep, setActiveStep] = useState(1); const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const copyToClipboard = (text: string, id: string) => { navigator.clipboard.writeText(text); setCopiedCode(id); setTimeout(() => setCopiedCode(null), 2000) }
  const flows = [["Cerbo GX + MPPT + Batteries", "MQTT Broker"], ["MQTT Broker", "Node-RED"], ["Node-RED", "InfluxDB + Grafana"], ["VRM API", "Cloud Dashboard"]]
  return <EnergyPasswordGuard><AppLayout><div className="space-y-6 p-4 sm:p-6"><PageHeader title={copy.title} description={copy.description} /><div className="mx-auto max-w-7xl">
    <Card className="mb-8 bg-card"><CardHeader><CardTitle>{copy.architecture}</CardTitle><CardDescription>{copy.architectureDetail}</CardDescription></CardHeader><CardContent><div className="space-y-4">{flows.map(([from,to]) => <div key={`${from}-${to}`} className="flex items-center justify-between rounded-lg bg-accent p-4"><div className="text-sm font-mono">{from}</div><ArrowRight className="h-5 w-5 text-primary" /><div className="text-sm font-mono">{to}</div></div>)}</div></CardContent></Card>
    <div className="mb-8 space-y-6">{steps.map((step,index) => <Card key={index} className={`cursor-pointer transition-all ${activeStep === index + 1 ? "ring-2 ring-primary" : ""}`} onClick={() => setActiveStep(index + 1)}><CardHeader><div className="flex items-start gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold text-white ${activeStep === index + 1 ? "bg-primary" : "bg-muted"}`}>{activeStep === index + 1 ? <Check className="h-5 w-5" /> : index + 1}</div><div><h2 className="text-lg font-semibold">{step[0]}</h2><p className="text-sm text-muted-foreground">{step[1]}</p></div></div></CardHeader>{activeStep === index + 1 && <CardContent><ul className="space-y-2">{step[2].map((detail) => <li key={detail} className="flex items-start gap-3 text-sm"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />{detail}</li>)}</ul></CardContent>}</Card>)}</div>
    <Card className="mb-8"><CardHeader><CardTitle>{copy.scriptTitle}</CardTitle><CardDescription>{copy.scriptDetail}</CardDescription></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">{copy.scriptIntro}</p><div className="rounded-lg border bg-accent/50 p-4"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold">vrm_data_fetcher.py</p><button onClick={() => copyToClipboard(pythonScript,"python")} className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground">{copiedCode === "python" ? <><Check className="h-3 w-3" />{copy.copied}</> : <><Copy className="h-3 w-3" />{copy.copy}</>}</button></div><pre className="max-h-80 overflow-x-auto rounded bg-background p-3 text-xs font-mono">{pythonScript}</pre></div><div className="flex gap-3 rounded-lg border border-blue-500/50 bg-blue-500/10 p-4"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" /><p className="text-sm">{copy.install}: <code className="rounded bg-background px-1">pip install requests</code></p></div></CardContent></Card>
    <Card><CardHeader><CardTitle>{copy.troubleshooting}</CardTitle><CardDescription>{copy.troubleshootingDetail}</CardDescription></CardHeader><CardContent className="space-y-4">{[[copy.mqttQuestion,copy.mqttAnswer],[copy.apiQuestion,copy.apiAnswer],[copy.grafanaQuestion,copy.grafanaAnswer],[copy.historyQuestion,copy.historyAnswer]].map(([q,a],i) => <div key={q} className={i ? "border-t pt-4" : ""}><p className="mb-2 font-semibold">{q}</p><p className="text-sm text-muted-foreground">{a}</p></div>)}</CardContent></Card>
  </div></div></AppLayout></EnergyPasswordGuard>
}
