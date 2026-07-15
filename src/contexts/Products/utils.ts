import { supabase_storage } from "@/lib/supabase/config"
import { Product } from "./interfaces"

export const removeCurrentFile = async (product: Product): Promise<void> => {
  if (product.image_path) {
    await supabase_storage.storage
      .from("myia_products")
      .remove([product.image_path])
  }
}
