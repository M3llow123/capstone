// SERVER ONLY. Records admin LOGIN / LOGOUT events in the "login_logout_log" table.
// It never throws: if the database is down, logging in or out must still work.

export type AuthAction = "LOGIN" | "LOGOUT";

export async function recordAuthEvent(name: string, action: AuthAction): Promise<void> {
  try {
    // Imported here (not at the top) so a missing Supabase setting can't break sign-in itself.
    const { supabaseAdmin } = await import("./supabaseAdmin");
    const { error } = await supabaseAdmin.from("login_logout_log").insert({ name, action });
    if (error) console.error("Could not record", action, "->", error.message);
  } catch (err) {
    console.error("Could not record", action, "->", err);
  }
}
