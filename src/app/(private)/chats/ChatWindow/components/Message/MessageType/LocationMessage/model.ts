import { Message } from "@/contexts/Chats/interfaces"
import { useEffect, useRef } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"

export interface ILocationMessageModel {
  w_full: boolean
  message: Message
  mapContainerRef: React.RefObject<HTMLDivElement> // Alterando para React.RefObject
}

const useLocationMessageModel = (
  w_full: boolean,
  message: Message
): ILocationMessageModel => {
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null) // Não precisa mudar aqui
  const markerRef = useRef<mapboxgl.Marker | null>(null)

  useEffect(() => {
    mapboxgl.accessToken =
      "pk.eyJ1IjoiZ3VpbGhlcm1lcmVpczEiLCJhIjoiY201eHc1YXp6MGFzbjJtb3BlY3o0eDA4ZSJ9.mHYZGNgmwMSIkMOPDdkcJg"

    const latitude =
      message.message.locationMessage?.degreesLatitude || -15.599150461729153
    const longitude =
      message.message.locationMessage?.degreesLongitude || -56.09829178697592

    if (mapContainerRef.current) {
      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v11",
        center: [longitude, latitude],
        zoom: 13,
        interactive: false, // Desabilita a interação
      })

      // Adiciona o marcador no local fixo
      const marker = new mapboxgl.Marker({ color: "red" })
        .setLngLat([longitude, latitude])
        .addTo(mapRef.current!)

      markerRef.current = marker
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
      }
    }
  }, [])

  return { w_full, message, mapContainerRef }
}

export default useLocationMessageModel
