# DESHI API

Backend da plataforma **DESHI**, desenvolvido com **Fastify** e **TypeScript** durante a Residência de Software.

Nesta etapa, a API implementa cadastro, login, logout com revogação de token no servidor e controle de acesso por perfil. A persistência é local, em arquivos JSON, e poderá ser substituída futuramente por um banco de dados por meio dos repositórios da aplicação.

## Tecnologias

- Node.js 22
- TypeScript
- Fastify
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

Crie o arquivo `.env` a partir de `.env.example` e informe uma chave de assinatura forte:

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

## Persistência

Os dados são persistidos localmente nos seguintes arquivos:

- `data/users.json`: usuários, incluindo o hash da senha;
- `data/revoked-tokens.json`: identificadores (`jti`) de tokens revogados e suas datas de expiração.

Senhas nunca são gravadas em texto puro: o cadastro usa `bcrypt` com custo 10. A lista de tokens revogados remove tokens expirados ao consultar ou registrar uma revogação.

## Autenticação e autorização

O login produz um JWT válido por uma hora, associado a um `jti` único. Rotas autenticadas exigem o cabeçalho:

```http
Authorization: Bearer <token>
```

O middleware de autenticação valida a assinatura e expiração do JWT, verifica se o token foi revogado e disponibiliza o identificador do usuário autenticado para a rota. O logout registra o `jti` do token em `data/revoked-tokens.json`, impedindo seu uso posterior.

As rotas de demonstração também usam autorização por perfil:

- `PROFESSIONAL`
- `STUDENT`

## Rotas

### Cadastro — `POST /users`

Cria um usuário. Todos os campos são obrigatórios.

```json
{
  "name": "Nome do usuário",
  "email": "usuario@email.com",
  "password": "senha-com-ao-menos-8-caracteres",
  "profile": "PROFESSIONAL"
}
```

Regras de validação:

- `name`: texto com, no mínimo, 3 caracteres;
- `email`: e-mail válido;
- `password`: texto com, no mínimo, 8 caracteres;
- `profile`: `PROFESSIONAL` ou `STUDENT`.

Resposta de sucesso (`200`):

```json
{
  "id": "uuid",
  "name": "Nome do usuário",
  "email": "usuario@email.com",
  "profile": "PROFESSIONAL",
  "createdAt": "2026-10-09T00:00:00.000Z",
  "updatedAt": "2026-10-09T00:00:00.000Z"
}
```

Erros conhecidos:

- `400`: `Formato de dados inválido!`;
- `409`: `E-mail já cadastrado.`

### Login — `POST /login`

Autentica um usuário por e-mail e senha.

```json
{
  "email": "usuario@email.com",
  "password": "senha-com-ao-menos-8-caracteres"
}
```

Resposta de sucesso (`200`):

```json
{
  "token": "jwt",
  "user": {
    "id": "uuid",
    "name": "Nome do usuário",
    "email": "usuario@email.com",
    "profile": "PROFESSIONAL"
  }
}
```

Erros conhecidos:

- `400`: `Formato de dados inválido!`;
- `401`: `E-mail ou senha inválidos.`

### Logout — `POST /logout`

Requer Bearer JWT. Revoga o token apresentado no servidor e retorna `204 No Content`.

```http
POST /logout
Authorization: Bearer <token>
```

### Rotas temporárias de demonstração

Estas rotas foram mantidas intencionalmente para demonstrar autenticação e autorização na próxima reunião. Não são rotas funcionais definitivas da aplicação.

| Método | Rota | Requisito | Resposta de sucesso |
| --- | --- | --- | --- |
| `GET` | `/professional-test` | Bearer JWT de usuário `PROFESSIONAL` | `{ "message": "Acesso profissional autorizado!" }` |
| `GET` | `/student-test` | Bearer JWT de usuário `STUDENT` | `{ "message": "Acesso estudante autorizado!" }` |

Em rotas autenticadas, a API pode responder com:

- `401` quando o token estiver ausente, inválido, expirado, revogado ou o usuário não for encontrado;
- `403` quando o usuário autenticado não tiver o perfil exigido.

> A rota `/protected-test` não está registrada no código atual. Caso ela seja necessária para a demonstração, deve ser implementada antes de ser adicionada a esta documentação.

## Scripts

| Script | Função |
| --- | --- |
| `npm run dev` | Executa `tsx watch src/server.ts` em desenvolvimento. |
| `npm run build` | Compila o projeto com `tsc`. |
| `npm start` | Executa a versão compilada com Node.js. |

## Estrutura principal

```text
src/
├── config/
│   └── env.ts
├── modules/users/
│   ├── repositories/
│   ├── users.controller.ts
│   ├── users.routes.ts
│   ├── users.schema.ts
│   └── users.service.ts
├── shared/auth/
│   ├── repositories/
│   ├── authenticate.ts
│   └── authorize-profile.ts
└── server.ts
```

O fluxo de cada operação segue a separação `Route → Controller → Service → Repository → Persistência`.
