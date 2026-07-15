"use client"
import React from "react"
import useCallsModel from "./model"

export default function CallsView({}: ReturnType<typeof useCallsModel>) {
  return (
    <div>
      <h1 className="text-3xl font-bold">Ligação</h1>
    </div>
  )
}
