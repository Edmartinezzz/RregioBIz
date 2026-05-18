import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Comprueba si las credenciales de Supabase en el .env.local son reales 
 * y no los marcadores de posición predeterminados de configuración.
 */
export const isSupabaseConfigured = (): boolean => {
  return (
    supabaseUrl.length > 0 &&
    !supabaseUrl.includes("tu-proyecto") &&
    supabaseAnonKey.length > 0 &&
    !supabaseAnonKey.includes("tu-anon-key")
  );
};

// Inicializar el cliente sólo si las credenciales son válidas
export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
