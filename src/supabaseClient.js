import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://nqtwrjqsigaunpgjhtvz.supabase.co";
const supabaseAnonKey = "sb_publishable_oFfb8Hv0HoWSMsGU-f3GLQ_P6G-7aHt";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);