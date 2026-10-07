"use client"

import { useEffect, useState } from "react"
import { Check, Download, Share2, Smartphone } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

const COPY = {
  es: {
    install: "Instalar Black Swan",
    installed: "Black Swan instalada",
    title: "Instalar Black Swan",
    description: "Déjala en la pantalla de inicio y ábrela como una app, sin pasar por App Store ni Google Play.",
    iosTitle: "iPhone / iPad",
    ios: "Abre Black Swan en Safari, toca Compartir y elige “Agregar a pantalla de inicio”.",
    androidTitle: "Android",
    android: "Abre Black Swan en Chrome, toca el menú ⋮ y elige “Instalar app” o “Agregar a pantalla principal”.",
    desktopTitle: "Computador",
    desktop: "En Chrome o Edge usa el icono Instalar de la barra de direcciones, o el menú del navegador.",
  },
  en: {
    install: "Install Black Swan",
    installed: "Black Swan installed",
    title: "Install Black Swan",
    description: "Keep it on your home screen and open it like an app, without using the App Store or Google Play.",
    iosTitle: "iPhone / iPad",
    ios: "Open Black Swan in Safari, tap Share, then choose “Add to Home Screen”.",
    androidTitle: "Android",
    android: "Open Black Swan in Chrome, tap the ⋮ menu, then choose “Install app” or “Add to Home screen”.",
    desktopTitle: "Computer",
    desktop: "In Chrome or Edge use the Install icon in the address bar, or the browser menu.",
  },
  de: {
    install: "Black Swan installieren",
    installed: "Black Swan installiert",
    title: "Black Swan installieren",
    description: "Lege Black Swan auf dem Startbildschirm ab und öffne es wie eine App – ohne App Store oder Google Play.",
    iosTitle: "iPhone / iPad",
    ios: "Öffne Black Swan in Safari, tippe auf Teilen und wähle „Zum Home-Bildschirm“.",
    androidTitle: "Android",
    android: "Öffne Black Swan in Chrome, tippe auf das Menü ⋮ und wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“.",
    desktopTitle: "Computer",
    desktop: "Verwende in Chrome oder Edge das Installationssymbol in der Adressleiste oder das Browsermenü.",
  },
} as const

export function PwaInstallAction({ language = "en" }: { language?: string }) {
  const copy = COPY[language as keyof typeof COPY] ?? COPY.en
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
    setInstalled(standalone)

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined)
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  async function install() {
    if (installed) return
    if (!deferredPrompt) {
      setGuideOpen(true)
      return
    }
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === "accepted") setInstalled(true)
    setDeferredPrompt(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void install()}
        disabled={installed}
        className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-70"
      >
        {installed ? <Check className="h-5 w-5" /> : <Download className="h-5 w-5" />}
        <span>{installed ? copy.installed : copy.install}</span>
      </button>

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 font-medium"><Share2 className="h-4 w-4" />{copy.iosTitle}</div>
              <p className="mt-2 text-muted-foreground">{copy.ios}</p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 font-medium"><Smartphone className="h-4 w-4" />{copy.androidTitle}</div>
              <p className="mt-2 text-muted-foreground">{copy.android}</p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 font-medium"><Download className="h-4 w-4" />{copy.desktopTitle}</div>
              <p className="mt-2 text-muted-foreground">{copy.desktop}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
