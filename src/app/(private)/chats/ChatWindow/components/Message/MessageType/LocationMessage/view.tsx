import React from "react"
import useLocationMessageModel from "./model"
import MessageMetadata from "../MessageMetadata/MessageMetadata"

export default function LocationMessageView({
  w_full,
  message,
  mapContainerRef,
}: ReturnType<typeof useLocationMessageModel>) {
  const googleMapsUrl = `https://www.google.com/maps?q=${message.message.locationMessage?.degreesLatitude},${message.message.locationMessage?.degreesLongitude}&z=15&output=embed`

  return (
    <div>
      <div
        className={`flex items-center rounded-lg shadow-md ${
          w_full ? "w-full h-[400px]" : "w-[400px] h-[200px]"
        }`}
      >
        <div
          id="map-container"
          className="rounded-md"
          style={{ width: "100%", height: "100%" }}
          ref={mapContainerRef}
        />
      </div>
      <div className="mt-2">
        <MessageMetadata message={message} />
      </div>

      {/* <div className="flex items-center rounded-lg shadow-md w-[400px] h-[200px]">
        <iframe
          src={googleMapsUrl}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen={false}
          loading="lazy"
        />
      </div> */}
    </div>
  )
}
