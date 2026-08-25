import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="hp:toaster hp:group"
      icons={{
        success: <CircleCheckIcon className="hp:size-4" />,
        info: <InfoIcon className="hp:size-4" />,
        warning: <TriangleAlertIcon className="hp:size-4" />,
        error: <OctagonXIcon className="hp:size-4" />,
        loading: <Loader2Icon className="hp:size-4 hp:animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--hp-popover)",
          "--normal-text": "var(--hp-popover-foreground)",
          "--normal-border": "var(--hp-border)",
          "--border-radius": "var(--hp-radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
