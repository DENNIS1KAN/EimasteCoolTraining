// Eimaste Cool Training: runtime settings.
// Paste your Supabase project URL and anon (public) key below to switch from demo mode to the shared app.
// Both values are safe to publish: access is protected by row-level security (see supabase/schema.sql).
// Supabase dashboard -> Project Settings -> API (or "Connect") shows both values.
// Use the "anon" / "publishable" key. NEVER the "service_role" / "secret" key: the app refuses to start with it.
window.ECT_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  // Logins use <name>-<invite>@<this domain> behind the scenes; nobody ever receives e-mail there.
  // Leave it empty to use this site's own address (e.g. dennis1kan.github.io), which nobody else can own.
  authEmailDomain: '',
}
