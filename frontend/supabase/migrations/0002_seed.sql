-- =========================================================
-- Maintenex :: migration reservada para compatibilidade
--
-- Este arquivo substitui o antigo seed de demonstração que ficava em
-- migrations/0002_seed.sql. Mantemos a versão 0002 como no-op para evitar
-- migration drift em bancos que já tenham registrado esta versão e para que
-- novos ambientes preservem a sequência histórica sem inserir dados demo.
--
-- Dados de demonstração vivem em ../seeds/demo.sql e devem ser executados
-- manualmente apenas quando necessário.
-- =========================================================

select 1;
