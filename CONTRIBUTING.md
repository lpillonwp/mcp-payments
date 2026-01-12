# Contributing

Obrigado por querer contribuir com o **payments-mcp**.

## Setup

- Node.js **18+**
    - Current Version used: 22.x
- npm

Instalação:

```bash
npm install
```

Rodar em desenvolvimento (stdio):

```bash
npm run dev
```

Build:

```bash
npm run build
```

## Como testar (manual)

- **MCP via stdio**: use um client MCP (ex: Cursor) apontando para o bin do projeto.
- **MCP over HTTP**: defina `MCP_HTTP_PORT` e use um client MCP HTTP (ver README).

## E2E via CLI

Smoke (read-only, exige credenciais):

```bash
npm run e2e:smoke
```

Full (cria recursos em Pagar.me/Woovi, exige envs adicionais para recipient/banco):

```bash
npm run e2e
```

## Padrões do projeto

- **TypeScript strict** (`tsconfig.json`)
- **Zod** para schemas de input/output
- **Sem segredos no repositório**: nunca commite `.env` nem credenciais.

## Adicionando novas tools

- Sempre adicionar em `src/integrations/<provider>/tools/*`
- Registrar no agregador: `src/tools/register.ts`
- Manter schemas em `src/integrations/<provider>/schemas/*`

## Pull requests

- Faça PRs pequenos e focados
- Descreva o que mudou e por quê
- Se o change altera contrato de tool (schema), atualize o `README.md`


