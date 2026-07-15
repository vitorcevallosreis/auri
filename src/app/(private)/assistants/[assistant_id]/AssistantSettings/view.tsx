"use client"

import React from "react"
import useAssistantSettingsModel from "./model"
import { Input } from "@/components/ui/input"
import {
  CircularProgress,
  Card,
  CardBody,
  CardFooter,
  Chip,
} from "@nextui-org/react"

export default function AssistantSettingsView({
  isLoading,
  assistant_settings,
  percentageUsed,
  percentageAvailable,
}: ReturnType<typeof useAssistantSettingsModel>) {
  return (
    <div>
      <div className="flex gap-4">
        <Card className="w-full border-none bg-gradient-to-br from-violet-500 to-fuchsia-500">
          <CardBody className="justify-center items-center pb-0">
            <CircularProgress
              classNames={{
                svg: "w-36 h-36 drop-shadow-md",
                indicator: "stroke-white",
                track: "stroke-white/10",
                value: "text-3xl font-semibold text-white",
              }}
              showValueLabel={true}
              strokeWidth={2}
              value={percentageUsed}
            />
          </CardBody>
          <CardFooter className="justify-center items-center pt-0">
            <Chip
              classNames={{
                base: "border-1 border-white/30",
                content: "text-white/90 text-small font-semibold",
              }}
              variant="bordered"
            >
              {isLoading ? (
                <span>Calculando...</span>
              ) : (
                <span>Tokens Usados - {assistant_settings?.used_tokens}</span>
              )}
            </Chip>
          </CardFooter>
        </Card>

        <Card className="w-full border-none bg-gradient-to-br from-yellow-400 to-orange-500">
          <CardBody className="justify-center items-center pb-0">
            <CircularProgress
              classNames={{
                svg: "w-36 h-36 drop-shadow-md",
                indicator: "stroke-white",
                track: "stroke-white/10",
                value: "text-3xl font-semibold text-white",
              }}
              showValueLabel={true}
              strokeWidth={2}
              value={percentageAvailable}
            />
          </CardBody>
          <CardFooter className="justify-center items-center pt-0">
            <Chip
              classNames={{
                base: "border-1 border-white/30",
                content: "text-white/90 text-small font-semibold",
              }}
              variant="bordered"
            >
              {isLoading ? (
                <span>Calculando...</span>
              ) : (
                <span>
                  Tokens Disponíveis - {assistant_settings?.available_tokens}
                </span>
              )}
            </Chip>
          </CardFooter>
        </Card>
      </div>

      <div className="mt-2">
        <div>Instância</div>

        <Input
          defaultValue={assistant_settings?.instance_conection as string}
          readOnly
        />
      </div>
    </div>
  )
}
