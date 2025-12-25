"use client"

import { useState } from "react"
import { EnergyPasswordGuard } from "@/components/energy-password-guard"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, AlertCircle, Copy, ArrowRight } from "lucide-react"

const steps = [
  {
    number: 1,
    title: "Enable VRM Portal & Generate API Token",
    description: "Register your Cerbo GX on Victron's cloud platform",
    details: [
      "Create account at https://vrm.victronenergy.com",
      "Link your Cerbo GX installation",
      "Navigate to Settings → API Access",
      'Click "Generate Token"',
      "Copy and save your API token securely",
    ],
  },
  {
    number: 2,
    title: "Configure MQTT on Cerbo GX",
    description: "Enable real-time data streaming",
    details: [
      "Access Cerbo GX web interface (http://<cerbo-ip>)",
      "Go to Settings → Services → dbus-mqtt",
      "Enable dbus-mqtt service",
      "Set MQTT broker (default: 127.0.0.1:1883)",
      "Optionally configure authentication",
    ],
  },
  {
    number: 3,
    title: "Setup Node-RED Integration",
    description: "Process data from Cerbo GX",
    details: [
      "Cerbo GX comes with Node-RED pre-installed",
      "Access at http://<cerbo-ip>:1880",
      "Create MQTT input node connected to Cerbo broker",
      "Add JSON parsing and filtering nodes",
      "Connect to InfluxDB or local data store",
    ],
  },
  {
    number: 4,
    title: "Deploy Monitoring Stack",
    description: "Store and visualize data",
    details: [
      "Run Docker Compose (InfluxDB + Grafana)",
      "Import pre-built dashboards",
      "Configure Grafana data source to InfluxDB",
      "Set up alert rules for critical values",
      "Access dashboard at http://localhost:3000",
    ],
  },
  {
    number: 5,
    title: "Verify System Integration",
    description: "Test all data flows",
    details: [
      "Check MQTT topics receiving data",
      "Verify InfluxDB has historical data",
      "Confirm Grafana dashboard displays values",
      "Test alert notifications",
      "Monitor system performance",
    ],
  },
]

const pythonScript = `#!/usr/bin/env python3
# VRM API Data Fetcher - Runs on your Cerbo GX or local server

import requests
import json
from datetime import datetime, timedelta
import time

# Configuration
VRM_ENDPOINT = "https://vrmapi.victronenergy.com/v2"
INSTALLATION_ID = "YOUR_INSTALLATION_ID"
API_TOKEN = "YOUR_API_TOKEN"
POLL_INTERVAL = 300  # 5 minutes

# Headers
headers = {
    "X-Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}

def fetch_device_data():
    """Fetch current device data from VRM"""
    try:
        response = requests.get(
            f"{VRM_ENDPOINT}/installations/{INSTALLATION_ID}/devices",
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching device data: {e}")
        return None

def fetch_historical_data(days=1):
    """Fetch historical energy data"""
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        response = requests.get(
            f"{VRM_ENDPOINT}/installations/{INSTALLATION_ID}/logdata",
            headers=headers,
            params={
                "start": int(start_date.timestamp()),
                "end": int(end_date.timestamp())
            },
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching historical data: {e}")
        return None

def process_data(raw_data):
    """Process VRM API data for local storage/visualization"""
    if not raw_data:
        return None
    
    processed = {
        "timestamp": datetime.now().isoformat(),
        "devices": {},
        "summary": {
            "total_solar_power": 0,
            "total_consumption": 0,
            "battery_soc": 0,
            "system_status": "operational"
        }
    }
    
    for device in raw_data.get('records', []):
        device_id = device.get('id')
        device_type = device.get('deviceType')
        
        processed['devices'][device_id] = {
            "name": device.get('name'),
            "type": device_type,
            "soc": device.get('current_battery_soc'),
            "power": device.get('current_power'),
            "voltage": device.get('voltage'),
            "current": device.get('current')
        }
        
        if device_type == "SolarCharger":
            processed['summary']['total_solar_power'] += device.get('current_power', 0)
        elif device_type == "InverterRS":
            processed['summary']['total_consumption'] += abs(device.get('current_power', 0))
        elif device_type == "Battery":
            processed['summary']['battery_soc'] = device.get('current_battery_soc', 0)
    
    return processed`

export default function VictronSetup() {
  const [activeStep, setActiveStep] = useState(1)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <EnergyPasswordGuard>
      <AppLayout>
        <div className="space-y-6 p-4 sm:p-6">
          <PageHeader title="Victron Setup Guide" description="Complete integration and configuration steps" />
          <div className="mx-auto max-w-7xl">
            {/* System Architecture Overview */}
            <Card className="bg-card border-border mb-8">
              <CardHeader>
                <CardTitle>System Architecture</CardTitle>
                <CardDescription>Data flow from Victron hardware to cloud and dashboards</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-accent rounded-lg">
                    <div className="text-sm font-mono text-foreground">Cerbo GX + MPPT + Batteries</div>
                    <ArrowRight className="w-5 h-5 text-primary" />
                    <div className="text-sm font-mono text-foreground">MQTT Broker</div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-accent rounded-lg">
                    <div className="text-sm font-mono text-foreground">MQTT Broker</div>
                    <ArrowRight className="w-5 h-5 text-primary" />
                    <div className="text-sm font-mono text-foreground">Node-RED</div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-accent rounded-lg">
                    <div className="text-sm font-mono text-foreground">Node-RED</div>
                    <ArrowRight className="w-5 h-5 text-primary" />
                    <div className="text-sm font-mono text-foreground">InfluxDB + Grafana</div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-accent rounded-lg">
                    <div className="text-sm font-mono text-foreground">VRM API</div>
                    <ArrowRight className="w-5 h-5 text-primary" />
                    <div className="text-sm font-mono text-foreground">Cloud Dashboard</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Setup Steps */}
            <div className="space-y-6 mb-8">
              {steps.map((step) => (
                <Card
                  key={step.number}
                  className={`bg-card border-border cursor-pointer transition-all ${
                    activeStep === step.number ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setActiveStep(step.number)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white ${
                            activeStep === step.number ? "bg-primary" : "bg-muted"
                          }`}
                        >
                          {activeStep === step.number ? <Check className="w-5 h-5" /> : step.number}
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-foreground">{step.title}</h2>
                          <p className="text-sm text-muted-foreground">{step.description}</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  {activeStep === step.number && (
                    <CardContent>
                      <ul className="space-y-2">
                        {step.details.map((detail, idx) => (
                          <li key={idx} className="flex items-start gap-3 text-sm text-foreground">
                            <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>

            {/* Python Script Example */}
            <Card className="bg-card border-border mb-8">
              <CardHeader>
                <CardTitle>Python VRM API Client</CardTitle>
                <CardDescription>Example script for fetching data from Victron VRM</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Run this script on any system with Python 3.7+ to continuously fetch and log data from your Victron
                  installation via the VRM API.
                </p>

                <div className="bg-accent/50 rounded-lg p-4 border border-border">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-foreground">vrm_data_fetcher.py</p>
                    <button
                      onClick={() => copyToClipboard(pythonScript, "python")}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                    >
                      {copiedCode === "python" ? (
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
                  <pre className="bg-background rounded p-3 text-xs font-mono text-foreground overflow-x-auto max-h-80">
                    {pythonScript}
                  </pre>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground">
                    Install required package: <code className="bg-background px-1 rounded">pip install requests</code>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Troubleshooting */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Troubleshooting</CardTitle>
                <CardDescription>Common issues and solutions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-semibold text-foreground mb-2">MQTT not connecting?</p>
                  <p className="text-sm text-muted-foreground">
                    Verify dbus-mqtt is enabled on Cerbo GX settings. Check firewall allows port 1883. Use
                    <code className="bg-background px-1 rounded">mosquitto_sub</code> to test connectivity.
                  </p>
                </div>
                <div className="border-t border-border pt-4">
                  <p className="font-semibold text-foreground mb-2">VRM API returning 401 errors?</p>
                  <p className="text-sm text-muted-foreground">
                    Verify your API token is valid and not expired. Check Authorization header format:
                    <code className="bg-background px-1 rounded">Bearer YOUR_TOKEN_HERE</code>
                  </p>
                </div>
                <div className="border-t border-border pt-4">
                  <p className="font-semibold text-foreground mb-2">Grafana not showing data?</p>
                  <p className="text-sm text-muted-foreground">
                    Ensure InfluxDB data source is configured correctly. Verify Node-RED is writing data to InfluxDB.
                    Check InfluxDB logs for errors.
                  </p>
                </div>
                <div className="border-t border-border pt-4">
                  <p className="font-semibold text-foreground mb-2">Missing data points in historical view?</p>
                  <p className="text-sm text-muted-foreground">
                    Data retention is limited by InfluxDB configuration. Check retention policy in InfluxDB settings.
                    Consider using 30-day retention for monthly reports.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    </EnergyPasswordGuard>
  )
}
