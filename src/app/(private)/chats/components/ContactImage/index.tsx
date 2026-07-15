import React from "react"
import { Image } from "@nextui-org/react"

interface ContactImageProps {
  avatar_url: string | null
  name: string
  width?: number
  height?: number
}

export default function ContactImage({
  name,
  avatar_url,
  width = 49,
  height = 49,
}: ContactImageProps) {
  return avatar_url ? (
    <Image
      alt={name}
      src={avatar_url}
      width={width}
      height={height}
      radius="full"
    />
  ) : (
    <div className="inline-flex items-center justify-center size-[46px] rounded-full bg-gray-500 text-lg font-semibold text-white leading-none">
      {name[0] ?? ""}
    </div>
  )
}
