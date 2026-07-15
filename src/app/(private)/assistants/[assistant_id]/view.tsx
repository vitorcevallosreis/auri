"use client"

import React from "react"
import { DashboardLayout } from "@/app/layout/dashboard-layout"
import useAssistantPageModel, { MenuItem } from "./model"
import Profile from "./Profile"
import { menuData } from "./menu"
import Setting from "./Setting"
import Trainings from "./Trainings"
import Personality from "./Personality"
import AssistantSettings from "./AssistantSettings"
import Channels from "./Channels"
import Integrations from "./Integrations"
import Statistic from "./Statistic"
import FollowUps from "./FollowUps"

export default function AssistantPageView({
  activeMenu,
  setActiveMenu,
}: ReturnType<typeof useAssistantPageModel>) {
  return (
    <DashboardLayout>
      <div className="flex flex-col h-screen shadow-lg border rounded-md mb-4 bg-card text-card-foreground">
        <div className="flex flex-1 gap-3">
          <div className="p-4 border-r w-[20%] bg-muted/30">
            <div className="space-y-8">
              {menuData.map((menu: MenuItem, index: number) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <span className="text-lg">{menu.icon}</span>
                    {menu.label}
                  </div>
                  <div className="pl-6 space-y-1">
                    {menu.subItems.map((subItem) => (
                      <button
                        key={subItem.id}
                        className={`block w-full text-left text-sm p-1 ${
                          activeMenu === subItem.id
                            ? "text-primary font-bold"
                            : "text-muted-foreground"
                        } hover:text-primary/80`}
                        onClick={() => setActiveMenu(subItem.id)}
                      >
                        {subItem.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 p-4 w-[80%]">
            {activeMenu === "profile" && <Profile />}
            {activeMenu === "settings" && <Setting />}
            {activeMenu === "trainings" && <Trainings />}
            {activeMenu === "personality" && <Personality />}
            {activeMenu === "channels" && <Channels />}
            {activeMenu === "integrations" && <Integrations />}
            {activeMenu === "followups" && <FollowUps />}
            {activeMenu === "statistic" && <Statistic />}
            {activeMenu === "assistant_settings" && <AssistantSettings />}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
