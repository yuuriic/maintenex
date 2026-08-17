create table cidade (
    id uuid primary key,
    nome varchar(160) not null,
    uf char(2) not null,
    ativa boolean not null default true,
    created_at timestamptz not null default now()
);

create table equipamento (
    id uuid primary key,
    printwayy_id varchar(100) unique,
    nome varchar(200),
    modelo varchar(160),
    fabricante varchar(120),
    numero_serie varchar(160),
    ip varchar(64),
    status varchar(40),
    cliente varchar(200),
    secretaria varchar(200),
    setor varchar(200),
    regiao varchar(160),
    ultima_comunicacao timestamptz,
    cidade_id uuid references cidade(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table pendencia (
    id uuid primary key,
    titulo varchar(200) not null,
    descricao text,
    status varchar(40) not null,
    prioridade varchar(30) not null,
    prazo date,
    equipamento_id uuid references equipamento(id),
    cidade_id uuid not null references cidade(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_equipamento_cidade on equipamento(cidade_id);
create index idx_pendencia_cidade_status on pendencia(cidade_id, status);
