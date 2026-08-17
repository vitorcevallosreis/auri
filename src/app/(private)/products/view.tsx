import React from "react"
import useProductsModel from "./model"
import { DashboardLayout } from "@/app/layout/dashboard-layout"
import { Button, ButtonGroup, Card, Image } from "@nextui-org/react"
import { slice_text } from "@/lib/utils/sanitize_text"
import CreateProduct from "./CreateProduct"
import { formatToBRL } from "../utils/Currency"
import UpdateProduct from "./UpdateProduct"

export default function ProductsView({
  filteredProducts,
  deleteProduct,
  categories,
  selectedCategory,
  setSelectedCategory,
}: ReturnType<typeof useProductsModel>) {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">
            Produtos ({filteredProducts.length})
          </h1>

          <CreateProduct />
        </div>

        <div>
          <ButtonGroup fullWidth radius="none">
            <Button
              onPress={() => setSelectedCategory(null)}
              color={selectedCategory === null ? "primary" : "default"}
            >
              Tudo
            </Button>
            {categories?.map((category) => (
              <Button
                key={category.id}
                onPress={() => setSelectedCategory(category.id)}
                color={selectedCategory === category.id ? "primary" : "default"}
              >
                {category.name}
              </Button>
            ))}
          </ButtonGroup>
        </div>

        <div className="grid grid-cols-5 gap-3 my-4">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className="p-5 flex flex-col justify-between shadow-none border border-border"
              radius="sm"
            >
              {product.image_path && (
                <div className="flex justify-center">
                  <Image
                    alt={product.name}
                    radius="sm"
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL}/${product.image_path}`}
                  />
                </div>
              )}

              <div className="">{slice_text(product.name, 25)}</div>
              <div className="text-sm text-muted-foreground">
                {slice_text(product.description, 90)}
              </div>

              <div className="text-center mt-3">
                {formatToBRL(product.price)}
              </div>

              <div className="flex justify-between items-center">
                <UpdateProduct product={product} />
                <Button
                  color="danger"
                  onPress={() => deleteProduct(product.id)}
                >
                  Apagar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
