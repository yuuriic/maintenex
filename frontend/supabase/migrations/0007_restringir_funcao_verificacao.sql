-- A função é exclusiva do trigger em auth.users e não deve ser exposta via RPC.
revoke all on function public.sincronizar_verificacao_usuario() from public, anon, authenticated;
