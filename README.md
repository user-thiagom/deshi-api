# DESHI API

Backend da plataforma **DESHI**, desenvolvido durante a Residência de Software.

O DESHI é uma plataforma de gerenciamento para profissionais que trabalham com treinamento de pessoas, permitindo administrar alunos, treinamentos, modalidades, sessões, evolução e outros recursos relacionados ao negócio.

Este projeto corresponde à API responsável pela lógica de negócio, autenticação, validação e persistência dos dados.

---

## 🚀 Tecnologias

O backend utiliza:

- **Node.js** — ambiente de execução JavaScript/TypeScript.
- **TypeScript** — adiciona tipagem estática ao JavaScript.
- **Fastify** — framework HTTP utilizado para construção da API.
- **Zod** — validação dos dados recebidos pela API em tempo de execução.
- **bcryptjs** — geração e comparação de hashes de senhas.
- **tsx** — execução do TypeScript diretamente durante o desenvolvimento, com suporte a watch mode.

A persistência atual utiliza **arquivos JSON**. A arquitetura foi organizada para permitir uma futura substituição por PostgreSQL ou outro banco de dados sem necessidade de alterar as regras de negócio do Service.

---

## 📋 Pré-requisitos

Antes de executar o projeto, tenha instalado:

- [Node.js](https://nodejs.org/)
- npm — instalado junto com o Node.js.

Para verificar as versões instaladas:

```bash
node --version
npm --version
```

O projeto foi desenvolvido utilizando Node.js 22.

---

## 📥 Instalação

Depois de clonar o repositório, entre na pasta do backend:

```bash
cd deshi-api
```

Instale as dependências:

```bash
npm install
```

O `npm install` utiliza o `package.json` para instalar automaticamente todas as dependências necessárias do projeto.

---

## ▶️ Executando o projeto

### Desenvolvimento

Para iniciar o servidor em modo de desenvolvimento:

```bash
npm run dev
```

O projeto utiliza `tsx watch`, portanto alterações nos arquivos TypeScript fazem o servidor ser reiniciado automaticamente.

Por padrão, a API é executada na porta:

```text
3030
```

A rota inicial pode ser acessada em:

```text
http://localhost:3030/
```

A resposta esperada atualmente é:

```text
API do DESHI funcionando!
```

---

## 🏗️ Build

Para transformar o código TypeScript em JavaScript:

```bash
npm run build
```

Os arquivos compilados são gerados na pasta:

```text
dist/
```

A estrutura é baseada em:

```text
src/ → código TypeScript
dist/ → código JavaScript compilado
```

---

## ▶️ Executando a versão compilada

Depois de executar o build:

```bash
npm run build
```

a aplicação pode ser iniciada com:

```bash
npm start
```

Esse comando executa:

```text
dist/server.js
```

utilizando o Node.js.

---

## 📜 Scripts disponíveis

Os scripts atualmente configurados no `package.json` são:

| Script | Comando | Função |
|---|---|---|
| `dev` | `tsx watch src/server.ts` | Executa o servidor em desenvolvimento e reinicia automaticamente quando arquivos são alterados |
| `build` | `tsc` | Compila o TypeScript para JavaScript |
| `start` | `node dist/server.js` | Executa a aplicação compilada |

### Fluxo recomendado durante o desenvolvimento

```bash
npm install
npm run dev
```

### Fluxo para testar a versão compilada

```bash
npm run build
npm start
```

---

## 📦 Dependências

### Dependências de produção

#### Fastify

```text
fastify
```

Framework utilizado para construir o servidor HTTP e definir as rotas da API.

É responsável pela comunicação HTTP da aplicação, recebendo requisições e enviando respostas.

---

#### Zod

```text
zod
```

Biblioteca utilizada para validação dos dados recebidos pela API.

Por exemplo, no cadastro de usuário, o schema verifica:

- nome;
- e-mail;
- senha;
- perfil do usuário.

A validação acontece em tempo de execução, pois os tipos do TypeScript sozinhos não conseguem validar dados enviados por clientes externos.

---

#### bcryptjs

```text
bcryptjs
```

Biblioteca utilizada para proteger as senhas dos usuários.

As senhas não são armazenadas em texto puro.

Durante o cadastro:

```text
senha
  ↓
bcrypt
  ↓
passwordHash
  ↓
persistência
```

Durante o login, o `bcrypt.compare()` será utilizado para verificar se a senha informada corresponde ao hash armazenado.

---

### Dependências de desenvolvimento

#### TypeScript

```text
typescript
```

Permite desenvolver o backend utilizando TypeScript e posteriormente compilá-lo para JavaScript.

O código-fonte fica em:

```text
src/
```

e o resultado da compilação fica em:

```text
dist/
```

---

#### tsx

```text
tsx
```

Utilizado durante o desenvolvimento para executar arquivos TypeScript diretamente.

Também fornece o modo `watch` utilizado pelo script:

```bash
npm run dev
```

---

#### @types/node

```text
@types/node
```

Fornece as definições de tipos do Node.js para o TypeScript.

Isso permite que o TypeScript reconheça APIs como:

```text
node:fs
node:crypto
```

entre outras funcionalidades do Node.js.

---

## 📁 Estrutura atual

A organização do backend utiliza uma abordagem baseada em **módulos**.

```text
src/
├── server.ts
│
└── modules/
    └── users/
        ├── users.routes.ts
        ├── users.controller.ts
        ├── users.service.ts
        ├── users.schema.ts
        ├── users.types.ts
        ├── users.errors.ts
        ├── users.mapper.ts
        │
        └── repositories/
            ├── user.repository.ts
            └── json-user.repository.ts
```

Também existe atualmente:

```text
data/
└── users.json
```

---

## 🧱 Arquitetura

O projeto separa as responsabilidades entre diferentes camadas.

```text
Route
  ↓
Controller
  ↓
Service
  ↓
Repository
  ↓
Persistência
```

### Route

Define os endpoints da API e direciona as requisições para os Controllers.

Exemplo:

```text
POST /users
```

---

### Controller

Responsável por lidar com a camada HTTP.

Entre suas responsabilidades estão:

- receber a requisição;
- validar os dados recebidos;
- chamar o Service;
- transformar erros conhecidos em respostas HTTP;
- devolver a resposta para o cliente.

O Controller não deve conter regras de negócio.

---

### Service

Concentra as regras de negócio da aplicação.

No cadastro de usuários, por exemplo, o Service:

1. verifica se o e-mail já está cadastrado;
2. impede a criação de e-mails duplicados;
3. gera o hash da senha;
4. solicita ao Repository a criação do usuário.

O Service não depende diretamente de HTTP nem de uma implementação específica de banco de dados.

---

### Repository

É responsável pela persistência dos dados.

O Service depende do contrato:

```text
UserRepository
```

e não diretamente de uma tecnologia específica.

Atualmente temos:

```text
UserRepository
      ↓
JsonUserRepository
      ↓
users.json
```

No futuro, podemos substituir por algo como:

```text
UserRepository
      ↓
PrismaUserRepository
      ↓
PostgreSQL
```

sem precisar reescrever as regras de negócio do Service.

---

### Schema

Os schemas do Zod definem e validam os dados recebidos pela API.

Exemplo conceitual:

```text
HTTP Request
     ↓
Zod Schema
     ↓
dados válidos
     ↓
Controller
```

---

### Types

O arquivo `users.types.ts` contém os tipos relacionados ao domínio de usuários.

Entre eles:

- `User`
- `UserProfile`
- `CreateUserData`
- `UserResponse`

É importante diferenciar os tipos internos do sistema dos objetos que são expostos pela API.

---

### Errors

`users.errors.ts` contém erros específicos relacionados às regras do módulo de usuários.

Exemplo:

```text
EmailAlreadyExistsError
```

Esse erro representa uma regra de negócio e posteriormente é convertido pelo Controller para:

```text
HTTP 409 Conflict
```

---

### Mapper

O `users.mapper.ts` é responsável por transformar objetos internos em objetos apropriados para serem enviados pela API.

Exemplo:

```text
User
 ↓
toUserResponse()
 ↓
UserResponse
```

Isso impede que informações internas, como:

```text
passwordHash
```

sejam enviadas ao cliente.

---

## 💾 Persistência atual

Durante a primeira etapa do projeto, os usuários são armazenados em:

```text
data/users.json
```

O arquivo é utilizado pelo `JsonUserRepository`.

A persistência em JSON foi adotada para manter a implementação inicial simples e permitir o desenvolvimento da API sem depender inicialmente de um banco de dados.

A arquitetura de Repository foi criada justamente para que essa implementação possa ser substituída posteriormente.

---

## 🔐 Senhas

As senhas **não são armazenadas em texto puro**.

Durante o cadastro, utilizamos:

```text
bcrypt.hash()
```

A senha fornecida pelo usuário é transformada em um hash antes de ser persistida.

Exemplo conceitual:

```text
"minhaSenha"
     ↓
bcrypt.hash()
     ↓
"$2b$10$..."
     ↓
users.json
```

No login, a aplicação utilizará:

```text
bcrypt.compare()
```

para verificar se a senha informada corresponde ao hash armazenado.

---

## 👤 Cadastro de usuário

Atualmente existe o endpoint:

```http
POST /users
```

O cadastro recebe:

```json
{
  "name": "Nome do usuário",
  "email": "usuario@email.com",
  "password": "senha-do-usuario",
  "profile": "PROFESSIONAL"
}
```

Os perfis disponíveis atualmente são:

```text
PROFESSIONAL
STUDENT
```

### Fluxo

```text
POST /users
      ↓
Validação com Zod
      ↓
Verificação de e-mail existente
      ↓
Hash da senha com bcrypt
      ↓
Repository
      ↓
users.json
      ↓
UserMapper
      ↓
UserResponse
```

Se o e-mail já estiver cadastrado:

```text
HTTP 409 Conflict
```

Se os dados enviados forem inválidos:

```text
HTTP 400 Bad Request
```

O `passwordHash` nunca deve ser enviado na resposta da API.

---

## 🌐 ES Modules

O projeto utiliza ES Modules.

No `package.json`:

```json
{
  "type": "module"
}
```

Por isso, ao importar arquivos locais em TypeScript, utilizamos a extensão `.js`:

```ts
import { UserService } from './users.service.js'
```

Mesmo que o arquivo de origem seja:

```text
users.service.ts
```

Essa configuração está relacionada ao funcionamento do TypeScript com Node.js utilizando `NodeNext`.

---

## 🧪 Testando a API

Durante o desenvolvimento, ferramentas como Postman ou Insomnia podem ser utilizadas para testar os endpoints.

Para iniciar a API:

```bash
npm run dev
```

Depois, envie as requisições para:

```text
http://localhost:3030
```

O endpoint de cadastro atualmente é:

```text
POST http://localhost:3030/users
```

---

## 🔮 Próximas etapas

O backend será desenvolvido de forma incremental.

Entre as próximas funcionalidades previstas estão:

- login;
- autenticação;
- controle de acesso por perfil;
- gerenciamento de alunos;
- modalidades;
- treinamentos;
- sessões;
- evolução dos alunos;
- outros recursos definidos no escopo do DESHI.

A arquitetura atual busca manter essas futuras funcionalidades desacopladas e permitir a evolução da persistência de JSON para um banco de dados posteriormente.

---

## 👥 Desenvolvimento em equipe

Ao clonar o projeto pela primeira vez:

```bash
npm install
```

Depois:

```bash
npm run dev
```

Cada integrante deve evitar alterar diretamente regras pertencentes a outros módulos sem alinhar previamente com a equipe.

Novas funcionalidades devem respeitar a separação de responsabilidades existente:

```text
Route
  ↓
Controller
  ↓
Service
  ↓
Repository
```

A organização por módulos deve ser mantida conforme o projeto crescer.

---

## 📌 Comandos rápidos

```bash
# Instalar dependências
npm install

# Desenvolvimento
npm run dev

# Gerar build
npm run build

# Executar build
npm start
```

---

**DESHI — Seu treino. Seus alunos. Seu negócio. Tudo em um só lugar.**