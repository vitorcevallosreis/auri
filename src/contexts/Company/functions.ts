import { supabase } from "@/lib/supabase/config"

const TABLE_ADDRESS: string = "myia_company_addresses"

export const check_ff_address_exists = async (
  company_id: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from(TABLE_ADDRESS)
      .select("*")
      .eq("company_id", company_id)
      .single()

    if (error) return false

    if (!data) return false

    return true
  } catch (error) {
    return false
  }
}
