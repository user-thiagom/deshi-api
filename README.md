# DESHI API

Backend da plataforma **DESHI**, desenvolvido com **Fastify** e **TypeScript** durante a Residência de Software.

A API oferece cadastro e autenticação de usuários, solicitações diretas de vínculo entre profissionais e alunos, convites para vínculo e consulta dos vínculos ativos. A persistência do protótipo usa arquivos JSON locais, por meio de repositórios que podem ser substituídos futuramente.

## Tecnologias

- Node.js 22
- TypeScript
- Fastify e `@fastify/cors`
- Zod
- bcryptjs
- jsonwebtoken
- dotenv

## Pré-requisitos

- [Node.js](https://nodejs.org/) 22 ou compatível
- npm

## Instalação e configuração

Instale as dependências:

```bash
npm install
```

Crie o arquivo `.env` a partir de `.env.example` e defina uma chave de assinatura forte:

```env
JWT_SECRET=uma_chave_secreta_longa_e_aleatoria
```

`JWT_SECRET` é obrigatória. A aplicação não inicia se ela não estiver definida.

## Execução

### Desenvolvimento

```bash
npm run dev
```

O servidor inicia na porta `3030` e é reiniciado automaticamente quando arquivos TypeScript são alterados.

```text
http://localhost:3030
```

A rota `GET /` retorna `API do DESHI funcionando!`.

### Build e produção

```bash
npm run build
npm start
```

O build compila `src/` para `dist/`. O comando `npm start` executa `dist/server.js`.

## Funcionalidades disponíveis

- Cadastro e login de usuários com perfil `PROFESSIONAL` ou `STUDENT`.
- Autenticação JWT, logout com revogação do token e autorização por perfil.
- Solicitações diretas de vínculo entre profissional e aluno, com aceite ou recusa pelo aluno.
- Convites de vínculo com código de oito caracteres e validade de sete dias.
- Consulta de alunos e profissionais ligados por vínculos ativos.
- Catálogo de modalidades e seleção de uma ou mais modalidades pelo profissional.
- Biblioteca de atividades padrão e atividades personalizadas do profissional, com busca por nome e filtro por modalidade.

As operações de programas, sessões, resultados e histórico não fazem parte das rotas atualmente disponíveis nesta API.

## Persistência

Os dados são mantidos localmente nos seguintes arquivos:

- `data/users.json`: usuários e hashes de senha;
- `data/revoked-tokens.json`: identificadores (`jti`) de tokens revogados e suas datas de expiração;
- `data/vinculos.json`: solicitações e vínculos, com os estados `PENDENTE`, `ATIVO` ou `RECUSADO`;
- `data/convites.json`: convites e seus estados `PENDENTE`, `ACEITO`, `RECUSADO` ou `EXPIRADO`.
- `data/modalidades.json`: catálogo de modalidades disponíveis.
- `data/profissional-modalidades.json`: modalidades selecionadas por cada profissional.
- `data/atividades.json`: catálogo padrão de atividades.
- `data/atividades-personalizadas.json`: atividades criadas por profissionais, isoladas por proprietário.

As senhas são armazenadas com hash bcrypt (custo 10), nunca em texto puro. Os arquivos JSON são a persistência de protótipo e não um banco de dados compartilhado para múltiplas instâncias.

## Autenticação e perfis

O login produz um JWT válido por uma hora, associado a um `jti` único. Rotas autenticadas exigem o cabeçalho:

```http
Authorization: Bearer <token>
```

A autenticação valida a assinatura e a expiração do token, verifica sua revogação e identifica o usuário. O logout registra o `jti` em `data/revoked-tokens.json`. Os perfis aceitos são `PROFESSIONAL` e `STUDENT`; as rotas de vínculos e convites também restringem as operações ao perfil correspondente.

## Rotas

### Usuários

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `POST` | `/users` | Público | Cadastra usuário com nome, e-mail, senha e perfil. |
| `POST` | `/login` | Público | Autentica por e-mail e senha e retorna token e usuário. |
| `POST` | `/logout` | Autenticado | Revoga o token apresentado; retorna `204 No Content`. |

Regras do cadastro: nome com pelo menos 3 caracteres, e-mail válido, senha com pelo menos 8 caracteres e perfil `PROFESSIONAL` ou `STUDENT`. E-mail já cadastrado retorna `409`.

### Solicitações diretas e vínculos

| Método | Rota | Perfil exigido | Descrição |
| --- | --- | --- | --- |
| `POST` | `/vinculos` | `PROFESSIONAL` | Cria uma solicitação pendente para o aluno informado em `alunoId`. |
| `PATCH` | `/vinculos/:id/aceitar` | `STUDENT` | O aluno destinatário aceita a solicitação pendente, ativando o vínculo. |
| `PATCH` | `/vinculos/:id/recusar` | `STUDENT` | O aluno destinatário recusa a solicitação pendente. |
| `GET` | `/vinculos/alunos` | `PROFESSIONAL` | Lista os alunos com vínculo ativo do profissional autenticado. |
| `GET` | `/vinculos/profissionais` | `STUDENT` | Lista os profissionais com vínculo ativo do aluno autenticado. |

Exemplo de corpo para criar solicitação:

```json
{
  "alunoId": "uuid-do-aluno"
}
```

As respostas de listagem contêm dados públicos dos usuários, sem o hash da senha. Solicitações pendentes ou recusadas não aparecem como vínculos ativos.

### Convites

| Método | Rota | Perfil exigido | Descrição |
| --- | --- | --- | --- |
| `POST` | `/vinculos/convites` | `PROFESSIONAL` | Cria convite para o aluno indicado em `alunoId` e retorna um código. |
| `GET` | `/vinculos/convites/:codigo` | `STUDENT` | Consulta convite destinado ao aluno autenticado. |
| `POST` | `/vinculos/convites/:codigo/aceitar` | `STUDENT` | Aceita convite válido do aluno autenticado e cria vínculo ativo. |
| `POST` | `/vinculos/convites/:codigo/recusar` | `STUDENT` | Recusa convite válido do aluno autenticado. |

O código do convite tem oito caracteres. Convites expiram após sete dias e somente o aluno destinatário pode consultá-los ou responder. Códigos inválidos retornam `400`, convites inexistentes retornam `404` e convites expirados retornam `410`.

### Modalidades

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `GET` | `/modalidades` | `PROFESSIONAL` | Lista o catálogo de modalidades. |
| `GET` | `/modalidades/minhas` | `PROFESSIONAL` | Lista as modalidades associadas ao profissional autenticado. |
| `PUT` | `/modalidades/minhas` | `PROFESSIONAL` | Substitui sua seleção de modalidades. |

O corpo do `PUT` contém `modalidadeIds`, uma lista não vazia de UUIDs sem repetição, todos existentes no catálogo. Exemplo:

```json
{
  "modalidadeIds": ["uuid-da-modalidade"]
}
```

### Biblioteca de atividades

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `GET` | `/atividades` | `PROFESSIONAL` | Lista atividades padrão e as personalizadas do profissional autenticado. |
| `POST` | `/atividades` | `PROFESSIONAL` | Cria uma atividade personalizada associada a uma modalidade existente. |

O `GET` aceita `busca` (busca parcial pelo nome) e `modalidadeId` (UUID da modalidade) como filtros opcionais. Os filtros podem ser combinados. Atividades personalizadas de outros profissionais não são retornadas.

O `POST` exige `nome` e `modalidadeId`; `descricao` e `midiaUrl` são opcionais. A mídia deve ser uma URL HTTP ou HTTPS. O proprietário e a origem da atividade são determinados pelo servidor.

### Rotas de teste de perfil

Estas rotas existem para demonstrar autenticação e autorização e não são funcionalidades de negócio:

| Método | Rota | Requisito | Resposta de sucesso |
| --- | --- | --- | --- |
| `GET` | `/professional-test` | JWT de usuário `PROFESSIONAL` | `{ "message": "Acesso profissional autorizado!" }` |
| `GET` | `/student-test` | JWT de usuário `STUDENT` | `{ "message": "Acesso estudante autorizado!" }` |

Em rotas autenticadas, a API pode responder com `401` para token ausente, inválido, expirado ou revogado, ou usuário não encontrado; `403` indica perfil sem autorização para a operação.

## Testes

Execute a suíte automatizada com:

```bash
npm test
```

O script compila o projeto e executa os arquivos `tests/*.test.mjs` em sequência. Os testes cobrem a biblioteca de atividades e os fluxos de convites e vínculos. As verificações específicas de seleção e persistência das modalidades ficam em `tests/modalidades.test.mjs`.

## Scripts

| Script | Função |
| --- | --- |
| `npm run dev` | Executa `tsx watch src/server.ts` em desenvolvimento. |
| `npm run build` | Compila o projeto com `tsc`. |
| `npm start` | Executa a versão compilada com Node.js. |
| `npm test` | Compila o projeto e executa todos os testes automatizados em sequência. |

## Estrutura principal

```text
src/
├── config/
│   └── env.ts
├── modules/
│   ├── atividades/
│   │   ├── repositories/
│   │   └── atividades.*
│   ├── modalidades/
│   │   ├── repositories/
│   │   └── modalidades.*
│   ├── users/
│   │   ├── repositories/
│   │   └── users.*
│   └── vinculos/
│       ├── repositories/
│       ├── convite.*
│       └── vinculos.*
├── shared/auth/
│   ├── repositories/
│   ├── authenticate.ts
│   └── authorize-profile.ts
└── server.ts
```

O fluxo de cada operação segue a separação `Route → Controller → Service → Repository → Persistência`.
