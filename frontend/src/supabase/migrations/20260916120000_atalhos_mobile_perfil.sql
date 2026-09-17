-- Atalhos personalizados da bottom navigation mobile, por usuário.
--
-- Guarda apenas os ids dos módulos (frontend/src/components/navegacao.ts), na ordem
-- em que aparecem na barra. Rótulos, rotas, ícones e permissões continuam no frontend.
-- NULL = usuário nunca personalizou (a barra usa a prioridade padrão).
--
-- É preferência visual, não autorização: ao carregar, o frontend cruza os ids com
-- navegacaoVisivel(papel) e descarta o que o usuário não pode acessar. Nenhuma
-- política muda: "profile_update" já permite ao próprio usuário (id = auth.uid())
-- e à administração prevista (owner da empresa / super_admin) atualizar a linha, e
-- o trigger proteger_papel() continua bloqueando os campos sensíveis.
begin;

alter table public.profiles
  add column if not exists atalhos_mobile jsonb;

-- Só a FORMA é validada aqui: NULL, ou array JSON de até 4 strings (o mesmo limite
-- de LIMITE_ATALHOS_MOBILE no frontend). Os ids em si não são conferidos no banco —
-- a lista de módulos vive em navegacao.ts e muda sem migração. Duplicatas ficam a
-- cargo do frontend (deduplica ao ler e ao salvar); não justificam função auxiliar.
alter table public.profiles
  drop constraint if exists profiles_atalhos_mobile_formato;
alter table public.profiles
  add constraint profiles_atalhos_mobile_formato check (
    atalhos_mobile is null
    or (
      jsonb_typeof(atalhos_mobile) = 'array'
      and jsonb_array_length(atalhos_mobile) <= 4
      and not (atalhos_mobile @? '$[*] ? (@.type() != "string")')
    )
  );

comment on column public.profiles.atalhos_mobile is
  'Ids dos módulos (navegacao.ts) fixados na bottom navigation mobile, em ordem. NULL = padrão. Preferência visual; não concede acesso.';

commit;
