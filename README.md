# DESHI API

API da plataforma DESHI para profissionais independentes de atividades físicas e seus alunos. Ela fornece autenticação, vínculos, convites, atividades, programas de treino, sessões, histórico, evolução e medidas corporais.

## Tecnologias

- Node.js 22 LTS e TypeScript
- Fastify 5 e `@fastify/cors`
- Zod para validação de entrada
- Prisma ORM com PostgreSQL hospedado no Neon
- `@prisma/adapter-neon` para conectar a API ao Neon
- JWT e bcryptjs para autenticação e senhas

## Requisitos

- Node.js 22 LTS
- npm
- Banco PostgreSQL no Neon ou PostgreSQL local

## Instalação e execução local

```bash
npm install
Copy-Item .env.example .env
```

Configure o `.env` antes de iniciar a aplicação. As variáveis necessárias são:

| Variável | Uso |
| --- | --- |
| `JWT_SECRET` | Chave privada usada para assinar os tokens. Defina um valor longo e aleatório. |
| `DATABASE_URL` | URL PostgreSQL usada pela aplicação. No Neon, use de preferência a conexão pooled. |
| `DIRECT_URL` | URL direta do Neon usada pelo Prisma Migrate. |
| `FRONTEND_ORIGINS` | Origens publicadas autorizadas pelo CORS, separadas por vírgulas. |
| `NODE_ENV` | Ambiente Node; assume `development` quando omitido. |

Exemplo de configuração, substituindo os valores pelas URLs fornecidas pelo Neon:

```env
JWT_SECRET=gere-uma-chave-longa-e-aleatoria
FRONTEND_ORIGINS=http://localhost:5173
DATABASE_URL=postgresql://usuario:senha@host-pooler.neon.tech/deshi?sslmode=require
DIRECT_URL=postgresql://usuario:senha@host.neon.tech/deshi?sslmode=require
```

Não versione `.env`, não envie as URLs do banco ao frontend e não compartilhe `JWT_SECRET`. O arquivo `.env.example` contém apenas valores ilustrativos.

Instale/aplique as migrações e inicie a API:

```bash
npm run db:migrate:dev
npm run dev
```

Em desenvolvimento, a API escuta na porta `3030` e em `0.0.0.0`, para permitir chamadas de dispositivos na mesma rede local. A rota `GET /` retorna `API do DESHI funcionando!`.

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Gera o Prisma Client e executa `src/server.ts` com recarga automática. |
| `npm run build` | Gera o Prisma Client e compila TypeScript para `dist/`. |
| `npm start` | Inicia `dist/server.js`. |
| `npm test` | Compila a API e executa os testes em `tests/`. |
| `npm run db:generate` | Gera o Prisma Client. |
| `npm run db:migrate:dev` | Cria/aplica migrações no banco de desenvolvimento. |
| `npm run db:migrate:deploy` | Aplica migrações existentes no banco de destino. |
| `npm run db:seed:check` | Valida os arquivos de importação sem gravar dados. |
| `npm run db:seed` | Importa os dados JSON legados para o banco relacional. |
| `npm run db:check` | Testa a conexão e executa consultas de leitura no banco. |

Para criar uma migração durante o desenvolvimento, use `npm run db:migrate:dev -- --name nome_da_mudanca`. Versione a migração criada em `prisma/migrations/` e aplique-a em produção com `npm run db:migrate:deploy`. Não use `prisma db push` para substituir migrações versionadas.

## PostgreSQL, Prisma e dados legados

O schema relacional está em `prisma/schema.prisma`; as migrações versionadas estão em `prisma/migrations/`. A aplicação usa Prisma como camada de persistência. O `DATABASE_URL` é usado pelo adapter Neon em runtime, enquanto `DIRECT_URL` permite ao Prisma Migrate acessar o banco diretamente.

Os arquivos em `data/*.json` são dados legados/de demonstração e servem como origem da importação feita por `prisma/seed.ts`; eles não substituem o banco PostgreSQL como persistência principal. A importação valida referências e duplicidades antes de gravar e executa a carga em transação. Antes de importar para um banco, confira os dados que serão carregados:

```bash
npm run db:seed:check
npm run db:seed
npm run db:check
```

O primeiro comando não altera o banco. O segundo importa o conjunto de dados mantido em `data/`; faça backup e confira esses arquivos antes de executá-lo em um ambiente que já contenha dados.

## Autenticação e perfis

As rotas autenticadas recebem:

```http
Authorization: Bearer <token>
```

O login retorna um JWT. A API valida sua assinatura, validade e revogação; `/logout` revoga o token apresentado. Os perfis são `PROFESSIONAL` e `STUDENT`. Rotas protegidas retornam `401` quando a autenticação falha e `403` quando o perfil não tem permissão.

## Rotas

Todas as rotas abaixo partem da origem da API, por exemplo `http://localhost:3030`. Rotas não marcadas como públicas exigem JWT. As verificações por perfil indicadas também são aplicadas pelo servidor.

### Autenticação e conta

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `POST` | `/users` | Público | Cadastra uma conta. |
| `POST` | `/login` | Público | Autentica e retorna token e perfil do usuário. |
| `POST` | `/logout` | Autenticado | Revoga o token atual. |
| `GET` | `/users/me/body-metrics` | Aluno | Lê as próprias medidas corporais. |
| `PUT` | `/users/me/body-metrics` | Aluno | Registra peso e altura. |
| `PUT` | `/users/me/profile` | Aluno | Atualiza dados do perfil do aluno. |
| `PUT` | `/users/me/password` | Aluno | Altera a senha. |
| `GET` | `/students/:studentId/body-metrics` | Profissional | Consulta medidas de aluno vinculado. |

### Vínculos e convites

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `GET` | `/vinculos/alunos` | Profissional | Lista alunos com vínculo ativo. |
| `DELETE` | `/vinculos/alunos/:studentId` | Profissional | Remove um vínculo ativo sem apagar programas ou sessões históricos. |
| `POST` | `/vinculos` | Profissional | Solicita vínculo direto com um aluno. |
| `PATCH` | `/vinculos/:id/aceitar` | Aluno | Aceita uma solicitação de vínculo. |
| `PATCH` | `/vinculos/:id/recusar` | Aluno | Recusa uma solicitação de vínculo. |
| `GET` | `/vinculos/profissionais` | Aluno | Lista profissionais com vínculo ativo. |
| `GET` | `/vinculos/convites` | Profissional | Lista convites pendentes. |
| `POST` | `/vinculos/convites` | Profissional | Cria convite por identificador do aluno. |
| `POST` | `/vinculos/convites/email` | Profissional | Cria convite por e-mail. |
| `GET` | `/vinculos/convites/:codigo` | Aluno | Consulta convite destinado ao aluno autenticado. |
| `POST` | `/vinculos/convites/:codigo/aceitar` | Aluno | Aceita convite válido. |
| `POST` | `/vinculos/convites/:codigo/recusar` | Aluno | Recusa convite válido. |

Os convites usam código e expiração; somente o aluno destinatário pode consultá-los ou responder. Consulte as validações dos módulos de vínculos e convites para os campos obrigatórios e estados de erro.

### Modalidades, atividades e programas

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `GET` | `/modalidades` | Profissional | Lista o catálogo de modalidades. |
| `GET` | `/modalidades/minhas` | Profissional | Lista as modalidades selecionadas pelo profissional. |
| `PUT` | `/modalidades/minhas` | Profissional | Atualiza a seleção de modalidades. |
| `GET` | `/atividades` | Profissional | Lista exercícios; aceita filtros de busca e modalidade. |
| `POST` | `/atividades` | Profissional | Cria uma atividade personalizada. |
| `PUT` | `/atividades/:id` | Profissional | Atualiza uma atividade personalizada própria. |
| `GET` | `/atividades/:id/campos-configuracao` | Profissional | Lista os campos usados na prescrição da atividade. |
| `POST` | `/atividades/:id/campos-configuracao` | Profissional | Define campos de configuração. |
| `POST` | `/atividades/:id/configuracoes` | Profissional | Cria uma configuração de atividade. |
| `GET` | `/configuracoes-atividades/:id` | Profissional | Consulta uma configuração. |
| `POST` | `/programas` | Profissional | Cria programa de treino para aluno vinculado. |
| `GET` | `/programas` | Autenticado | Lista programas visíveis para o usuário. |
| `GET` | `/programas/:id` | Autenticado | Consulta um programa autorizado. |
| `PUT` | `/programas/:id` | Profissional | Atualiza programa próprio. |

### Sessões e evolução

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `POST` | `/sessions` | Aluno | Inicia sessão de um programa disponível. |
| `GET` | `/sessions/history` | Aluno | Lista histórico e sessões ativas do aluno. |
| `POST` | `/sessions/:sessionId/activities/:activityId/start` | Aluno | Inicia atividade. |
| `POST` | `/sessions/:sessionId/activities/:activityId/pause` | Aluno | Pausa atividade. |
| `POST` | `/sessions/:sessionId/activities/:activityId/resume` | Aluno | Retoma atividade. |
| `POST` | `/sessions/:sessionId/activities/:activityId/rest/start` | Aluno | Inicia descanso. |
| `POST` | `/sessions/:sessionId/activities/:activityId/rest/end` | Aluno | Encerra descanso. |
| `POST` | `/sessions/:sessionId/activities/:activityId/complete` | Aluno | Conclui atividade. |
| `POST` | `/sessions/:sessionId/executions` | Aluno | Registra dados de execução de série ou round. |
| `POST` | `/sessions/:sessionId/activities/:activityId/observations` | Aluno | Registra comentário sobre a atividade. |
| `POST` | `/sessions/:sessionId/pause` | Aluno | Pausa sessão. |
| `POST` | `/sessions/:sessionId/resume` | Aluno | Retoma sessão. |
| `POST` | `/sessions/:sessionId/finish` | Aluno | Finaliza sessão. |
| `POST` | `/sessions/:sessionId/interrupt` | Aluno | Interrompe sessão. |
| `GET` | `/students/:studentId/sessions/history` | Profissional | Consulta sessões de aluno vinculado. |
| `GET` | `/sessions/:sessionId` | Profissional | Consulta o resultado detalhado da sessão. |
| `GET` | `/sessions/:sessionId/result` | Profissional | Consulta resultado da sessão. |
| `GET` | `/students/:studentId/evolution` | Profissional | Consulta evolução de aluno vinculado. |
| `GET` | `/professional/home` | Profissional | Retorna indicadores, sessões ativas e atividade recente. |

As rotas de sessão verificam a propriedade e o estado atual da sessão antes de alterar ou retornar dados.

## CORS e frontend

Em desenvolvimento, a API permite automaticamente origens locais do Vite nas portas `5173` a `5180`, incluindo endereços da rede privada. Para produção, configure `FRONTEND_ORIGINS` com a origem exata do frontend publicado, sem caminho, por exemplo:

```env
FRONTEND_ORIGINS=https://seu-frontend.vercel.app
```

Para mais de uma origem, separe por vírgula. O frontend deve configurar `VITE_API_URL` com a origem desta API.

## Publicar na Vercel

O repositório da API deve ser configurado como um projeto separado do frontend, com a raiz do projeto apontando para este repositório. Configure no projeto Vercel:

- `JWT_SECRET`
- `DATABASE_URL` (Neon pooled)
- `DIRECT_URL` (Neon direct)
- `FRONTEND_ORIGINS` (origem publicada do frontend)

O `postinstall` e o `prebuild` geram o Prisma Client. `vercel.json` inclui o artefato WebAssembly do Prisma Client na função. Aplique as migrações no banco de destino antes de publicar código que dependa delas:

```bash
npm run db:migrate:deploy
```

Não inclua credenciais em variáveis `VITE_*`, no código do frontend ou no Git. A API usa a porta `3030` no desenvolvimento local; o domínio publicado da Vercel é a origem que o frontend deve consumir.

## Estrutura principal

```text
src/
├── config/              # Ambiente e compatibilidade com dados legados
├── modules/             # users, vinculos, modalidades, atividades,
│                        # programas, sessões e home profissional
├── shared/auth/         # Autenticação, autorização e revogação de tokens
├── shared/database/     # Prisma Client e repositórios PostgreSQL
└── server.ts            # Fastify, CORS e registro dos módulos

prisma/
├── migrations/          # Histórico versionado do schema
├── schema.prisma        # Modelos e relações PostgreSQL
└── seed.ts              # Importação validada dos JSON legados

data/                    # Arquivos históricos/de demonstração usados pelo seed
tests/                   # Testes dos módulos e fluxos da API
scripts/                 # Verificações auxiliares, incluindo conexão com Neon
```

Os módulos organizam rotas, controllers, serviços, schemas e repositórios. O fluxo padrão é `Route → Controller → Service → Repository → Prisma/PostgreSQL`.
