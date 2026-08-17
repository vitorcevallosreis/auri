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
          <div className="w-[20vw] shrink-0 h-full border-r border-border bg-card flex flex-col min-h-0 overflow-hidden items-stretch select-none">
            <div className="grid grid-cols-2">
              <div
                onClick={() => set_show_archiveds(!show_archiveds)}
                className="flex justify-between items-center px-4 py-3 cursor-pointer transition-all duration-200 hover:bg-muted/80 border-r border-border group"
              >
                <span className="text-sm font-medium text-foreground group-hover:text-foreground">
                  {show_archiveds ? "Conversas" : "Arquivados"}
                </span>
                <div className="text-muted-foreground group-hover:text-muted-foreground transition-colors duration-200">
                  {show_archiveds ? <ArrowUpFromDot size={16} /> : <ArrowDown size={16} />}
                </div>
              </div>
              <CreateChat />
            </div>
            <div className="w-full bg-card max-h-screen overflow-y-auto overflow-hidden">
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
