"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"
import type { CSSProperties } from "react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--ink)",
          "--normal-border": "var(--rule-strong)",
          "--success-bg": "var(--brass-soft)",
          "--success-text": "var(--brass-deep)",
          "--success-border": "var(--brass)",
          "--error-bg": "color-mix(in oklab, var(--crimson) 12%, var(--card))",
          "--error-text": "var(--ink)",
          "--error-border": "var(--crimson)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "border shadow-sm",
          title: "serif text-ink",
          description: "text-ink-muted text-sm",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
