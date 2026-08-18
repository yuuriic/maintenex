-- =========================================================
-- Maintenex :: promover um usuário a super_admin (plataforma)
--
-- Rode UMA vez, trocando o e-mail abaixo pelo da conta que administra a
-- plataforma. super_admin enxerga e gerencia todas as empresas.
-- =========================================================

update profiles
set papel = 'super_admin', empresa_id = null
where lower(email) = lower('TROQUE-PELO-SEU-EMAIL@empresa.com.br');
