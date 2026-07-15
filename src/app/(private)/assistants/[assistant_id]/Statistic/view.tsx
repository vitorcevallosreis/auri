"use client"

import React from "react"
import usestatisticModel from "./model"
import {
  CircularProgress,
  Card,
  CardBody,
  CardFooter,
  Chip,
} from "@nextui-org/react"

export default function StatisticView({
  value1,
  value2,
  value3,
}: ReturnType<typeof usestatisticModel>) {
  return (
    <div className="flex gap-2">
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
            strokeWidth={4}
            value={value1}
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
            Resoluções de Problemas
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
            strokeWidth={4}
            value={value2}
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
            Clientes Satisfeitos
          </Chip>
        </CardFooter>
      </Card>

      <Card className="w-full border-none bg-gradient-to-br from-red-500 to-pink-600">
        <CardBody className="justify-center items-center pb-0">
          <CircularProgress
            classNames={{
              svg: "w-36 h-36 drop-shadow-md",
              indicator: "stroke-white",
              track: "stroke-white/10",
              value: "text-3xl font-semibold text-white",
            }}
            showValueLabel={true}
            strokeWidth={4}
            value={value3}
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
            Problemas não Resolvidos
          </Chip>
        </CardFooter>
      </Card>
    </div>
  )
}
