# Maintenex

Reimplementação independente do sistema Maintenex, originalmente criado no Base44.

## Arquitetura

- `backend`: Java 21, Spring Boot, Spring Security, JWT, JPA e PostgreSQL
- `frontend`: React, Vite e TypeScript (será implementado na próxima etapa)
- `docker-compose.yml`: PostgreSQL local


## Pré-requisitos

- JDK 21 ou superior
- Maven 3.9+
- Docker Desktop (recomendado para o PostgreSQL)
- Node.js 22+ para o frontend

## Executar o banco

```bash
docker compose up -d database
```

## Executar o backend

```bash
cd backend
mvn spring-boot:run
```

A API ficará disponível em `http://localhost:8080`. O perfil local cria e atualiza
as tabelas por meio do Flyway. Antes de publicar, substitua `JWT_SECRET` por um segredo
forte e use migrações Flyway.

## Executar o frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend ficará disponível em `http://localhost:5173` e encaminhará chamadas
`/api` para o Spring Boot em `http://localhost:8080`.

## Próximas etapas

1. Completar os campos das entidades a partir das telas e regras do app original.
2. Implementar autenticação JWT e escopo por cidade/almoxarifado.
3. Criar os endpoints de estoque, checklists, pendências e Printwayy.
4. Reproduzir as páginas no frontend React.
5. Migrar os dados do Base44 por CSV/API, quando disponíveis.
