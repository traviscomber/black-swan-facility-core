"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock, AlertTriangle } from "lucide-react"

const ENERGY_PASSWORD = "Global2025..."

interface EnergyPasswordGuardProps {
  children: React.ReactNode
}

export function EnergyPasswordGuard({ children }: EnergyPasswordGuardProps) {
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleUnlock = () => {
    setError("")
    if (password === ENERGY_PASSWORD) {
      setIsUnlocked(true)
      setPassword("")
    } else {
      setError("Incorrect password")
      setPassword("")
    }
  }

  if (!isUnlocked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="w-full max-w-md bg-card border-accent/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Lock className="h-5 w-5 text-accent" />
              Restricted Access
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              This section requires authorization. Enter the password to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Warning Banner */}
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-200">
                This is a restricted area containing sensitive off-grid energy system data. Access is monitored.
              </p>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <Label htmlFor="energy-password" className="text-foreground">
                Access Password
              </Label>
              <Input
                id="energy-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleUnlock()}
                placeholder="Enter password"
                className="bg-input text-foreground placeholder:text-muted-foreground"
                autoFocus
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleUnlock}
                className="flex-1 bg-primary hover:bg-primary/90 text-white font-semibold"
                disabled={!password}
              >
                Unlock
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
