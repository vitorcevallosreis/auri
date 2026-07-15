import React from "react"
import useServicesModel from "./model"
import { DashboardLayout } from "@/app/layout/dashboard-layout"
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Button,
} from "@nextui-org/react"
import CreateService from "./CreateService"
import { formatToBRL } from "../utils/Currency"
import UpdateService from "./UpdateService"
import { slice_text } from "@/lib/utils/sanitize_text"

export default function ServicesView({
  services,
  isLoading,
  deleteService,
}: ReturnType<typeof useServicesModel>) {
  return (
    <DashboardLayout>
      <div className="space-y-6 flex justify-between items-center mb-3">
        <h1 className="text-3xl font-bold">Serviços ({services.length})</h1>

        <CreateService />
      </div>

      {!isLoading && (
        <Table aria-label="Serviços">
          <TableHeader>
            <TableColumn>NOME</TableColumn>
            <TableColumn>DESCRIÇÃO</TableColumn>
            <TableColumn>PREÇO</TableColumn>
            <TableColumn>DISPONÍVEL</TableColumn>
            <TableColumn>AÇÕES</TableColumn>
          </TableHeader>
          <TableBody>
            {services.map((service, index) => (
              <TableRow key={index}>
                <TableCell>{service.name}</TableCell>
                <TableCell>{slice_text(service.description)}</TableCell>
                <TableCell>{formatToBRL(service.price)}</TableCell>
                <TableCell>
                  {service.available ? (
                    <Chip color="primary">Sim</Chip>
                  ) : (
                    <Chip color="danger">Não</Chip>
                  )}
                </TableCell>

                <TableCell className="flex gap-2">
                  <UpdateService service={service} />
                  <Button
                    color="danger"
                    onPress={() => deleteService(service.id)}
                  >
                    Apagar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </DashboardLayout>
  )
}
