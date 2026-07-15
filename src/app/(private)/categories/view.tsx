import useCategoriesModel from "./model"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { DashboardLayout } from "@/app/layout/dashboard-layout"
import CreateCategory from "./CreateCategory"
import { Button } from "@nextui-org/react"

export default function CategoriesView({
  isLoading,
  categories,
  destroyCategory,
}: ReturnType<typeof useCategoriesModel>) {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Categorias ({categories.length})</h1>
        <CreateCategory />

        <Table>
          <TableCaption>Listando Categorias</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          {!isLoading && (
            <TableBody>
              {categories?.map((category, index: number) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="flex gap-2">
                    {/* <Button>Editar</Button> */}
                    <Button
                      color="danger"
                      onPress={() => destroyCategory(category.id)}
                    >
                      Apagar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>Total</TableCell>
              <TableCell className="text-right">{categories.length}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </DashboardLayout>
  )
}
