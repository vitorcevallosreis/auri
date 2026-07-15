import { supabase } from "@/lib/supabase/config"
import { Service } from "./interfaces"

export const removeCurrentFile = async (service: Service): Promise<boolean> => {
  try {
    if (!service.image_path) return true

    const { error } = await supabase.storage
      .from("services")
      .remove([service.image_path])

    if (error) throw error

    return true
  } catch (error) {
    console.error("Error removing file: ", error)
    return false
  }
}
