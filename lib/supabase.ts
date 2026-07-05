import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rdsmngtxytftnrxhuurp.supabase.co";
const supabaseAnonKey = "sb_publishable_lZ2zexM3tGS8zv2mqdrk_w_TDiE-IP5";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
