"use client"

import useChannelsModel from "./model"
import ChannelsView from "./view"

export default function Channels() {
  const channelsModel = useChannelsModel()

  return <ChannelsView {...channelsModel} />
}
