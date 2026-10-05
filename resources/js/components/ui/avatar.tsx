import * as AvatarPrimitive from "@radix-ui/react-avatar"
import * as React from "react"

import { cn } from "@/lib/utils"

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-avatar-neutral text-avatar-neutral-fg flex size-full items-center justify-center rounded-full font-bold",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }

/** Initials colours of the design (Komponen "Avatar"), picked per name. */
const AVATAR_TONES = [
  "bg-avatar-blue text-avatar-blue-fg",
  "bg-avatar-teal text-avatar-teal-fg",
  "bg-avatar-amber text-avatar-amber-fg",
] as const

/** Stable tone for a person: the same name always gets the same colour. */
function avatarTone(name: string): string {
  let hash = 0

  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }

  return AVATAR_TONES[hash % AVATAR_TONES.length]
}

export { avatarTone }
