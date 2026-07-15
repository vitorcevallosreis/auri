"use client"

import React from "react"
import usechatsModel from "./model"
import ChatList from "./ChatList"
import Chat from "./ChatWindow"
import { ArrowDown, ArrowUpFromDot } from "lucide-react"
import CreateChat from "./CreateChat"
import { DashboardLayout } from "@/app/layout/dashboard-layout"

export default function chatsView({
  show_archiveds,
  set_show_archiveds,
}: ReturnType<typeof usechatsModel>) {
  return (
    <DashboardLayout>
      <div className="h-full flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <div className="w-[20vw] shrink-0 h-full border-r border-gray-200 bg-white flex flex-col min-h-0 overflow-hidden items-stretch select-none">
            <div className="grid grid-cols-2">
              <div
                onClick={() => set_show_archiveds(!show_archiveds)}
                className="flex justify-between items-center px-4 py-3 cursor-pointer transition-all duration-200 hover:bg-gray-50/80 border-r border-gray-100 group"
              >
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  {show_archiveds ? "Conversas" : "Arquivados"}
                </span>
                <div className="text-gray-400 group-hover:text-gray-600 transition-colors duration-200">
                  {show_archiveds ? <ArrowUpFromDot size={16} /> : <ArrowDown size={16} />}
                </div>
              </div>
              <CreateChat />
            </div>
            <div className="w-full bg-white max-h-screen overflow-y-auto overflow-hidden">
              <ChatList />
            </div>
          </div>
          <div className="w-full h-full min-h-0 flex flex-col overflow-hidden">
            <Chat />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
