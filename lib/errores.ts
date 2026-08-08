// Los errores de los SDKs de Supabase (PostgrestError, AuthError y sus
// variantes, StorageError y las suyas) heredan de Error, así que un
// simple `error instanceof Error ? error.message : ""` los deja pasar
// tal cual — y su .message es texto crudo de Postgres/la API de
// Supabase, a veces con nombres de tabla o columna, que no debería
// llegarle directo a alguien usando la app. Los errores propios de la
// app (new Error("..."), o subclases como ErrorCobroParcial) sí traen
// un mensaje pensado para mostrarse, así que esos SÍ pasan.
function esErrorDeSupabase(nombre: string): boolean {
  return nombre === "PostgrestError" || nombre.startsWith("Auth") || nombre.startsWith("Storage");
}

export function mensajeErrorSeguro(error: unknown): string {
  if (!(error instanceof Error)) return "";
  return esErrorDeSupabase(error.name) ? "" : error.message;
}
