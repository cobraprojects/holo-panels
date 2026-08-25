import { cn } from "../lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("hp:animate-pulse hp:rounded-md hp:bg-accent", className)}
      {...props}
    />
  )
}

export { Skeleton }
