"use client"

import { useRouter } from "next/navigation"

import { useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Code, Copy, ExternalLink, Check } from "lucide-react"

export default function IntegrationDocs() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"mqtt" | "node-red" | "vrm" | "grafana">("mqtt")
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const mqttConfig = `# Victron Cerbo GX MQTT Configuration
# Connection settings for dbus-mqtt service

mosquitto_sub -h <cerbo-ip> -p 1883 -t "N/+/system/#" -v
# OR for Venus OS Large
mosquitto_sub -h <cerbo-ip> -p 1883 -t "N/+/#" -v`

  const noderRedFlow = `[
  {
    "id": "victron_mqtt_in",
    "type": "mqtt in",
    "z": "8f5b8c9d",
    "name": "Victron Data",
    "topic": "N/+/system/0/Dc/Battery/Soc",
    "qos": "2",
    "broker": "default"
  },
  {
    "id": "parse_soc",
    "type": "json",
    "z": "8f5b8c9d",
    "name": "Parse SOC"
  },
  {
    "id": "influx_out",
    "type": "influxdb out",
    "z": "8f5b8c9d",
    "measurement": "battery_soc",
    "tags": "building",
    "database": "victron_energy"
  }
]`

  const vrmApiExample = `// VRM JSON REST API Example
const vrm_api_endpoint = "https://vrmapi.victronenergy.com/v2";
const installation_id = "YOUR_INSTALLATION_ID";
const auth_token = "YOUR_API_TOKEN";

async function getBatterySoc() {
  const response = await fetch(
    \`\${vrm_api_endpoint}/installations/\${installation_id}/devices\`,
    {
      headers: {
        "X-Authorization": \`Bearer \${auth_token}\`,
        "Content-Type": "application/json"
      }
    }
  );
  
  const data = await response.json();
  
  // Filter battery devices
  const batteries = data.records.filter(d => d.deviceType === "Battery");
  
  batteries.forEach(battery => {
    console.log(\`Battery \${battery.name}: \${battery.current_battery_soc}%\`);
  });
}`

  const grafanaConfig = `# Docker Compose for InfluxDB & Grafana with Victron Venus OS

version: '3.8'
services:
  influxdb:
    image: influxdb:2.6
    container_name: influxdb
    ports:
      - "8086:8086"
    environment:
      INFLUXDB_ADMIN_USER: victron
      INFLUXDB_ADMIN_PASSWORD: your_secure_password
      INFLUXDB_HTTP_AUTH_ENABLED: "true"
    volumes:
      - influxdb-storage:/var/lib/influxdb2

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: your_admin_password
      GF_INSTALL_PLUGINS: grafana-piechart-panel
    volumes:
      - grafana-storage:/var/lib/grafana
    depends_on:
      - influxdb

volumes:
  influxdb-storage:
  grafana-storage:`

  return (
    <AppLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <PageHeader title="Integration Documentation" description="MQTT, Node-RED, VRM API & Grafana guides" />
        <div className="mx-auto max-w-7xl">
          {/* Tab Navigation */}
          <div className="mb-6 flex flex-wrap gap-2 border-b border-border">
            {["mqtt", "node-red", "vrm", "grafana"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as typeof activeTab)}
                className={`px-4 py-3 font-medium transition-colors border-b-2 uppercase text-sm ${
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "vrm" ? "VRM API" : tab === "node-red" ? "Node-RED" : tab.toUpperCase()}
              </button>
            ))}
          </div>

          {/* MQTT Tab */}
          {activeTab === "mqtt" && (
            <div className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>MQTT Integration with Cerbo GX</CardTitle>
                  <CardDescription>Real-time data streaming via Message Queuing Telemetry Transport</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">Overview</h3>
                    <p className="text-muted-foreground mb-3">
                      The Cerbo GX uses dbus-mqtt to publish real-time Victron Energy data over MQTT. This allows
                      integration with Node-RED, Home Assistant, Telegraf, and other monitoring systems.
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li>Default MQTT Port: 1883 (unencrypted) or 8883 (encrypted)</li>
                      <li>
                        Topic Structure: N/{"{device_instance}"}/system/0/{"{property}"}
                      </li>
                      <li>Authentication: Optional (configure in Cerbo GX settings)</li>
                      <li>QoS Levels: 0, 1, or 2 supported</li>
                    </ul>
                  </div>

                  <div className="bg-accent/50 rounded-lg p-4 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-mono text-sm font-semibold text-foreground">Subscribe to Battery SOC</h4>
                      <button
                        onClick={() => copyToClipboard(mqttConfig, "mqtt-config")}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                      >
                        {copiedCode === "mqtt-config" ? (
                          <>
                            <Check className="w-3 h-3" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="bg-background rounded p-3 text-xs font-mono text-foreground overflow-x-auto">
                      {mqttConfig}
                    </pre>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">Key Topics to Monitor</h3>
                    <div className="space-y-2 text-sm font-mono">
                      <div className="flex justify-between items-center p-2 bg-accent rounded">
                        <span className="text-foreground">N/+/system/0/Dc/Battery/Soc</span>
                        <span className="text-muted-foreground">Battery State of Charge (%)</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-accent rounded">
                        <span className="text-foreground">N/+/system/0/Dc/Battery/Voltage</span>
                        <span className="text-muted-foreground">Battery Voltage (V)</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-accent rounded">
                        <span className="text-foreground">N/+/system/0/Dc/Battery/Current</span>
                        <span className="text-muted-foreground">Battery Current (A)</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-accent rounded">
                        <span className="text-foreground">N/+/solar/+/Dc/0/Power</span>
                        <span className="text-muted-foreground">Solar Power (W)</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-accent rounded">
                        <span className="text-foreground">N/+/vebus/+/Ac/ActiveIn/L1/P</span>
                        <span className="text-muted-foreground">AC Power Input (W)</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Node-RED Tab */}
          {activeTab === "node-red" && (
            <div className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Node-RED Flow for Victron Data</CardTitle>
                  <CardDescription>Low-code workflow automation and data processing</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">Setup Steps</h3>
                    <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
                      <li>Enable Node-RED on Cerbo GX (Settings → Services → Node-RED)</li>
                      <li>Install MQTT, InfluxDB, and Prometheus nodes from Node-RED palette</li>
                      <li>Connect MQTT input node to Cerbo GX broker</li>
                      <li>Process data and send to InfluxDB or external dashboards</li>
                      <li>Set up alerts for critical thresholds (battery low, inverter errors, etc.)</li>
                    </ol>
                  </div>

                  <div className="bg-accent/50 rounded-lg p-4 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-mono text-sm font-semibold text-foreground">Sample Node-RED Flow</h4>
                      <button
                        onClick={() => copyToClipboard(noderRedFlow, "node-red")}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                      >
                        {copiedCode === "node-red" ? (
                          <>
                            <Check className="w-3 h-3" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="bg-background rounded p-3 text-xs font-mono text-foreground overflow-x-auto">
                      {noderRedFlow}
                    </pre>
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
                    <p className="text-sm text-foreground flex items-start gap-2">
                      <ExternalLink className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-400" />
                      <span>
                        Venus OS Large comes with Node-RED pre-installed. Access it at{" "}
                        <code className="bg-background px-1 rounded">http://&lt;cerbo-ip&gt;:1880</code>
                      </span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* VRM API Tab */}
          {activeTab === "vrm" && (
            <div className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Victron VRM JSON REST API</CardTitle>
                  <CardDescription>Cloud-based API for system monitoring and data retrieval</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">Getting Started</h3>
                    <ol className="list-decimal list-inside space-y-3 text-muted-foreground mb-6">
                      <li>Register at Victron Energy Portal (https://vrm.victronenergy.com)</li>
                      <li>Link your Cerbo GX installation</li>
                      <li>Generate API tokens in account settings</li>
                      <li>Use tokens to authenticate API requests</li>
                    </ol>

                    <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 mb-6">
                      <p className="text-sm text-foreground">
                        <strong>Endpoint:</strong> https://vrmapi.victronenergy.com/v2
                      </p>
                      <p className="text-sm text-foreground mt-2">
                        <strong>Authentication:</strong> X-Authorization header with Bearer token
                      </p>
                    </div>
                  </div>

                  <div className="bg-accent/50 rounded-lg p-4 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-mono text-sm font-semibold text-foreground">API Request Example</h4>
                      <button
                        onClick={() => copyToClipboard(vrmApiExample, "vrm-api")}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                      >
                        {copiedCode === "vrm-api" ? (
                          <>
                            <Check className="w-3 h-3" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="bg-background rounded p-3 text-xs font-mono text-foreground overflow-x-auto">
                      {vrmApiExample}
                    </pre>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">Available Endpoints</h3>
                    <div className="space-y-2">
                      <div className="p-3 bg-accent rounded border border-border">
                        <p className="font-mono text-sm text-foreground">GET /installations/{"{id}"}/devices</p>
                        <p className="text-xs text-muted-foreground mt-1">List all devices in installation</p>
                      </div>
                      <div className="p-3 bg-accent rounded border border-border">
                        <p className="font-mono text-sm text-foreground">GET /installations/{"{id}"}/logdata</p>
                        <p className="text-xs text-muted-foreground mt-1">Historical energy data</p>
                      </div>
                      <div className="p-3 bg-accent rounded border border-border">
                        <p className="font-mono text-sm text-foreground">GET /sites/{"{id}"}</p>
                        <p className="text-xs text-muted-foreground mt-1">Site/installation details</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Grafana Tab */}
          {activeTab === "grafana" && (
            <div className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Grafana Dashboards with InfluxDB</CardTitle>
                  <CardDescription>Open-source visualization and alerting platform</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">Architecture</h3>
                    <p className="text-muted-foreground mb-4">
                      Victron Cerbo GX → Node-RED → InfluxDB → Grafana Dashboard
                    </p>
                    <div className="bg-accent/50 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold">
                          1
                        </div>
                        <p className="text-sm text-foreground">Node-RED collects data via MQTT</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold">
                          2
                        </div>
                        <p className="text-sm text-foreground">InfluxDB stores time-series metrics</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold">
                          3
                        </div>
                        <p className="text-sm text-foreground">Grafana queries and visualizes data</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-accent/50 rounded-lg p-4 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-mono text-sm font-semibold text-foreground">Docker Compose Setup</h4>
                      <button
                        onClick={() => copyToClipboard(grafanaConfig, "grafana")}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                      >
                        {copiedCode === "grafana" ? (
                          <>
                            <Check className="w-3 h-3" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="bg-background rounded p-3 text-xs font-mono text-foreground overflow-x-auto">
                      {grafanaConfig}
                    </pre>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">Dashboard Templates</h3>
                    <p className="text-muted-foreground mb-4">
                      Pre-built Grafana dashboards for Victron systems are available in the community:
                    </p>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Code className="w-4 h-4 text-primary" />
                        <a href="#" className="text-primary hover:underline">
                          Victron Energy Dashboard Template #10570
                        </a>
                      </li>
                      <li className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Code className="w-4 h-4 text-primary" />
                        <a href="#" className="text-primary hover:underline">
                          Solar System Monitoring Dashboard
                        </a>
                      </li>
                      <li className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Code className="w-4 h-4 text-primary" />
                        <a href="#" className="text-primary hover:underline">
                          Battery Health & Performance Dashboard
                        </a>
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* General Resources */}
          <Card className="bg-card border-border mt-8">
            <CardHeader>
              <CardTitle>Additional Resources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a
                  href="https://www.victronenergy.com/live/ccgx:venus_os_large:intro"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-accent rounded hover:bg-accent/80 transition-colors group"
                >
                  <ExternalLink className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">Venus OS Documentation</p>
                    <p className="text-xs text-muted-foreground">Official Victron Energy documentation</p>
                  </div>
                </a>
                <a
                  href="https://vrmapi.victronenergy.com/swagger-ui.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-accent rounded hover:bg-accent/80 transition-colors group"
                >
                  <ExternalLink className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">VRM API Swagger</p>
                    <p className="text-xs text-muted-foreground">Interactive API documentation</p>
                  </div>
                </a>
                <a
                  href="https://nodered.org/docs/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-accent rounded hover:bg-accent/80 transition-colors group"
                >
                  <ExternalLink className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">Node-RED Documentation</p>
                    <p className="text-xs text-muted-foreground">Node-RED programming guide</p>
                  </div>
                </a>
                <a
                  href="https://grafana.com/grafana/dashboards"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-accent rounded hover:bg-accent/80 transition-colors group"
                >
                  <ExternalLink className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">Grafana Dashboards</p>
                    <p className="text-xs text-muted-foreground">Community dashboard templates</p>
                  </div>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
