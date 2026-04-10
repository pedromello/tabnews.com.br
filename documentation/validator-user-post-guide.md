# Guia didático: `validator`, `models` e `filterInput` (foco em `POST /api/v1/users`)

Este guia explica, passo a passo, como o projeto valida entrada de dados hoje e como reproduzir uma versão simples da estratégia para criação de usuário.

## 1) Fluxo real no projeto (visão de arquitetura)

No endpoint `POST /api/v1/users`, o pipeline principal é:

1. `postValidationHandler` valida e limpa `request.body` com `validator(...)`.
2. `authorization.filterInput(...)` faz **whitelist** dos campos permitidos para a feature `create:user`.
3. `user.create(...)` valida novamente no model (`validatePostSchema`) e executa regras de domínio (unicidade, hash, etc.).
4. saída passa por `authorization.filterOutput(...)` antes de responder.

> Essa combinação cria uma defesa em camadas: validação na borda + autorização/whitelist + validação no domínio.

---

## 2) Como o `models/validator.js` funciona

### 2.1 Contrato da função principal

`validator(object, keys)` recebe:

- `object`: payload de entrada (query/body/cookies/output etc.).
- `keys`: mapa `{ campo: 'required' | 'optional' }`.

Exemplo real (POST users):

```js
validator(request.body, {
  username: 'required',
  email: 'required',
  password: 'required',
});
```

### 2.2 Passo a passo interno

1. **Sanitização de JSON**

   - faz `JSON.parse(JSON.stringify(object))`.
   - remove `undefined` e garante payload serializável.
   - se quebrar, lança `ValidationError` com código `MODEL:VALIDATOR:ERROR_PARSING_JSON`.

2. **Cache de schema composto**

   - cria uma chave com `Object.keys(keys).join(',')`.
   - se não existir no cache, monta o schema final:
     - começa em `defaultSchema`.
     - para cada campo, busca uma função em `schemas[field]`.
     - concatena tudo com `Joi.concat(...)`.
   - guarda no `cachedSchemas`.

3. **Execução da validação Joi**

   - usa `stripUnknown: true` (remove chaves fora do schema).
   - injeta `context.required = keys` para as regras `when('$required.xxx', ...)`.

4. **Tratamento de erro padronizado**

   - pega o primeiro erro de Joi e converte para `ValidationError`.
   - define `errorLocationCode: MODEL:VALIDATOR:FINAL_SCHEMA`.

5. **Retorno limpo**
   - retorna `value` já transformado (trim/lowercase/defaults etc.).

### 2.3 Por que funciona bem

- **Composição**: cada campo possui seu mini-schema reutilizável.
- **Contexto de required/optional**: mesmo schema serve para POST e PATCH.
- **Hardening**: `stripUnknown` reduz superfície de ataque.
- **Mensagens consistentes**: `defaultSchema.messages(...)` centraliza erros.
- **Performance**: cache evita recompilar schema toda requisição.

---

## 3) Schemas relevantes para criar usuário

No `schemas`:

- `username`: `string`, `alphanum`, min 3, max 30, `trim`, check de nomes reservados.
- `email`: `email`, min 7, max 254, `lowercase`, `trim`.
- `password`: min 8, max 72, `trim`.

Essas transformações explicam os testes com:

- email com maiúsculas -> persiste em minúsculas.
- espaço antes/depois -> removido em campos com `trim()`.

---

## 4) Como `filterInput` entra no fluxo

`authorization.filterInput(user, 'create:user', input)` retorna apenas:

```js
{
  username: input.username,
  email: input.email,
  password: input.password,
}
```

Depois faz `JSON.parse(JSON.stringify(...))` para remover `undefined`.

### Por que isso é importante

Mesmo com validação no handler, o `filterInput` impede passagem acidental de campos sensíveis (ex.: `features`, `tabcoins`, `role`, etc.) para a camada de domínio.

---

## 5) Como os testes de `POST /api/v1/users` provam isso

Os testes cobrem duas ideias centrais:

1. **Validação de schema**

   - faltou campo obrigatório -> `400` com `MODEL:VALIDATOR:FINAL_SCHEMA`.
   - tipo inválido, formato inválido, tamanho inválido -> `400` + key correta.

2. **Limpeza/normalização de input**
   - payload com `unknownKey` ainda cria usuário (`201`), mostrando remoção de campo desconhecido.
   - username/email/password com espaços são normalizados conforme schema.
   - email em caixa alta é persistido em minúsculas.

---

## 6) Implementação simples (para seu sistema)

Abaixo uma versão **minimalista** inspirada no projeto, focada só em criar usuário.

### 6.1 Validator simples

```js
// validator.js
import Joi from 'joi';

const cache = {};

const base = Joi.object().required().min(1);

const fieldSchemas = {
  username: () =>
    Joi.object({
      username: Joi.string().alphanum().min(3).max(30).trim().when('$required.username', {
        is: 'required',
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
    }),

  email: () =>
    Joi.object({
      email: Joi.string().email().min(7).max(254).trim().lowercase().when('$required.email', {
        is: 'required',
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
    }),

  password: () =>
    Joi.object({
      password: Joi.string().min(8).max(72).trim().when('$required.password', {
        is: 'required',
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
    }),
};

export function validator(input, keys) {
  const serialized = JSON.parse(JSON.stringify(input));
  const cacheKey = Object.keys(keys).join(',');

  if (!cache[cacheKey]) {
    let schema = base;
    for (const key of Object.keys(keys)) {
      schema = schema.concat(fieldSchemas[key]());
    }
    cache[cacheKey] = schema;
  }

  const { value, error } = cache[cacheKey].validate(serialized, {
    stripUnknown: true,
    context: { required: keys },
  });

  if (error) {
    const err = new Error(error.details[0].message);
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    err.key = error.details[0]?.context?.key;
    throw err;
  }

  return value;
}
```

### 6.2 Filter input simples

```js
// authorization.js
export function filterInputCreateUser(input) {
  return JSON.parse(
    JSON.stringify({
      username: input.username,
      email: input.email,
      password: input.password,
    }),
  );
}
```

### 6.3 Endpoint POST simples

```js
// users.controller.js (Express/Next/Fastify, pseudo)
import { validator } from './validator.js';
import { filterInputCreateUser } from './authorization.js';

export async function createUserHandler(req, res) {
  const clean = validator(req.body, {
    username: 'required',
    email: 'required',
    password: 'required',
  });

  const secureInput = filterInputCreateUser(clean);

  // user.create(secureInput)
  // response filtered output
  return res.status(201).json({ username: secureInput.username });
}
```

---

## 7) Exemplos de entrada/saída da validação

### Exemplo A: válido com normalização

Entrada:

```json
{
  "username": "  MyUser  ",
  "email": "TEST@MAIL.COM ",
  "password": " senhaforte123 ",
  "extra": "ignorar"
}
```

Saída de `validator`:

```json
{
  "username": "MyUser",
  "email": "test@mail.com",
  "password": "senhaforte123"
}
```

### Exemplo B: faltando username

Entrada:

```json
{
  "email": "a@b.com",
  "password": "12345678"
}
```

Saída: erro 400 com chave `username`.

---

## 8) Testes mínimos recomendados (estilo do projeto)

```js
import { validator } from './validator';
import { filterInputCreateUser } from './authorization';

test('remove unknown key e normaliza', () => {
  const clean = validator(
    {
      username: ' User ',
      email: 'TEST@MAIL.COM ',
      password: ' 12345678 ',
      role: 'admin',
    },
    { username: 'required', email: 'required', password: 'required' },
  );

  expect(clean).toEqual({
    username: 'User',
    email: 'test@mail.com',
    password: '12345678',
  });
});

test('erro quando campo obrigatório falta', () => {
  expect(() =>
    validator(
      { email: 'x@y.com', password: '12345678' },
      { username: 'required', email: 'required', password: 'required' },
    ),
  ).toThrow();
});

test('filterInput mantém whitelist', () => {
  const filtered = filterInputCreateUser({
    username: 'u',
    email: 'e@mail.com',
    password: '12345678',
    features: ['admin'],
  });

  expect(filtered).toEqual({
    username: 'u',
    email: 'e@mail.com',
    password: '12345678',
  });
});
```

---

## 9) Estratégia prática para você implementar no seu sistema

1. Comece com **3 campos** (`username`, `email`, `password`).
2. Tenha um **validator central** com `stripUnknown`.
3. Adote **`filterInput` por feature** com whitelist explícita.
4. Faça **validação no endpoint e no model** (defesa em camadas).
5. Escreva testes para:
   - obrigatório ausente;
   - tipo/formato inválido;
   - trim/lowercase;
   - remoção de campo extra;
   - whitelist no `filterInput`.

Isso já reproduz o núcleo da arquitetura do projeto, de forma simples e escalável.
