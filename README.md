# payments-mcp

MCP Server (Model Context Protocol) para centralizar integrações de pagamento:

- **Pagar.me (Core API v5)**: customers, recipients, Pix, cartão, split 100%, charges, captura/cancelamento, tokenização (card_token)
- **Woovi/OpenPix**: charges Pix, consulta/listagem, deleção, refunds, verificação de webhook (HMAC)

O servidor expõe **tools MCP** para serem chamadas por um client MCP (ex: um agente/LLM), via **stdio** (padrão) ou **MCP over HTTP** (opcional).

## Licença

MIT - Veja: `./LICENSE`.

---

## Stack e arquitetura

- **Node.js + TypeScript**
- **MCP TypeScript SDK** (`@modelcontextprotocol/sdk`) usando o **`McpServer` (high-level)** com `registerTool` e schemas Zod.
- **Zod** para validação de entrada
- **Axios** para Woovi/OpenPix
- **SDK oficial Pagar.me** `@pagarme/pagarme-nodejs-sdk`
- **Express** (opcional): para expor **MCP over HTTP** (`/mcp`) via `StreamableHTTPServerTransport`

Estrutura de pastas (clean, por domínio):

- `src/index.ts`: bootstrap do MCP server (stdio)
- `src/http/server.ts`: transport HTTP opcional (MCP over HTTP)
- `src/mcp/server.ts`: factory de criação do `McpServer` (tools registradas)
- `src/tools/register.ts`: registry central de tools
- `src/mcp/utils.ts`: helpers de resposta/erro (`ok`, `fail`)
- `src/integrations/pagarme/*`: client, schemas e tools Pagar.me
- `src/integrations/woovi/*`: client, schemas e tools Woovi/OpenPix

---

## Requisitos

- Node.js 18+ (recomendado) / npm
- Credenciais de Pagar.me e/ou Woovi/OpenPix

---

## Instalação

```bash
npm install
```

Build:

```bash
npm run build
```

Rodar (stdio):

```bash
npm start
```

Dev:

```bash
npm run dev
```

> Observação: o build sempre limpa `dist/` antes de compilar.

---

## Variáveis de ambiente

Crie um `.env` na raiz (ou exporte no ambiente):

Copie o template:

```bash
cp env.example .env
```

### Pagar.me

- `PAGARME_API_KEY` (**obrigatória**): usada como Basic Auth username (password vazio)
- `PAGARME_PUBLIC_KEY` (opcional, mas recomendado): necessária para `pagarme_create_card_token` / `pagarme_get_token`

### Woovi/OpenPix

- `WOOVI_APP_ID` (**obrigatória**): header `Authorization` (AppID)
- `WOOVI_BASE_URL` (opcional):
  - produção: `https://api.openpix.com.br/api/v1` (default)
  - sandbox: `https://api.woovi-sandbox.com/api/v1`

---

## Modos de execução (MCP)

### MCP via stdio (local)

Modo padrão (ex: Cursor). O client MCP executa este processo e conversa via `stdin/stdout`.

### MCP over HTTP (opcional)

Se você definir `MCP_HTTP_PORT`, o servidor também expõe MCP via HTTP (Streamable HTTP).

Exemplo:

```bash
export MCP_HTTP_PORT=3001
npm start
```

Endpoints:

- `GET /health`
- `POST /mcp` (protocolo MCP)
- `GET /mcp` (protocolo MCP, com sessão)
- `DELETE /mcp` (protocolo MCP, com sessão)

> Importante: isso é **MCP over HTTP**, não é uma REST API para o frontend.
>
> Para usar via HTTP, utilize um **client MCP HTTP** (ex: `StreamableHTTPClientTransport`). O servidor usa **sessões** via header `mcp-session-id` (o client gerencia isso automaticamente).

Exemplo (TypeScript) de client MCP HTTP:

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({ name: "my-client", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL("http://localhost:3001/mcp"));

await client.connect(transport);
// Agora você pode listar/callar tools via MCP
```

---

## Rodar com Docker

### Build da imagem

```bash
docker build -t payments-mcp:local .
```

### Subir como serviço (MCP over HTTP)

Opção 1 (docker run):

```bash
docker run --rm -p 3001:3001 --env-file .env -e MCP_HTTP_PORT=3001 payments-mcp:local
```

Opção 2 (docker compose):

```bash
docker compose up --build
```

Health check:

```bash
curl -s http://localhost:3001/health
```

### Rodar E2E dentro do container

Smoke:

```bash
docker run --rm --env-file .env payments-mcp:local npm run e2e:smoke
```

Full:

```bash
docker run --rm --env-file .env payments-mcp:local npm run e2e
```

## Pagar.me — funcionalidades (tools MCP)

### Customers

- `pagarme_create_customer`
- `pagarme_get_customer`
- `pagarme_update_customer_metadata`

### Recipients (personal)

- `pagarme_create_recipient`
- `pagarme_update_recipient_default_bank_account`
- `pagarme_get_recipients`

### Orders / Pix / Cartão (split 100%)

- `pagarme_get_order`
- `pagarme_create_order_pix_split`
- `pagarme_create_order_credit_card_split`

**Split 100%:**

- O recipient (personal) recebe 100% do valor do pedido e **arcará com as taxas** (configurado como `liable=true` e `chargeProcessingFee=true` no split do payment).

### Charges

- `pagarme_get_charge`
- `pagarme_get_charge_transactions` (útil para Pix — QRCode vem das transações)
- `pagarme_capture_charge` (quando cartão foi criado com `capture=false`)
- `pagarme_cancel_charge`

### Tokenização (cartão)

- `pagarme_create_card_token` (usa `PAGARME_PUBLIC_KEY` ou `publicKey` no payload)
- `pagarme_get_token`

---

## Woovi/OpenPix — funcionalidades (tools MCP)

As tools foram implementadas seguindo a documentação do OpenPix (Woovi), incluindo:

### Charges (Pix)

- `woovi_create_charge` (POST `/api/v1/charge`)
- `woovi_get_charge` (GET `/api/v1/charge/{id}`)
- `woovi_list_charges` (GET `/api/v1/charge` com filtros)
- `woovi_delete_charge` (DELETE `/api/v1/charge/{id}`)

**Saída “pronta para FrontEnd”**:

As tools `woovi_create_charge` e `woovi_get_charge` retornam um objeto normalizado com:

- `charge.brCode`
- `charge.qrCodeImage`
- `charge.paymentLinkUrl`
- `charge.expiresDate`
- `charge.status`
- e `raw` com o payload integral da API

### Refunds

- `woovi_create_refund` (POST `/api/v1/refund`)
- `woovi_list_refunds` (GET `/api/v1/refund`)
- `woovi_get_refund` (GET `/api/v1/refund/{id}`)
- `woovi_get_charge_refunds` (GET `/api/v1/charge/{id}/refund`)
- `woovi_create_charge_refund` (POST `/api/v1/charge/{id}/refund`)

### Webhook

- `woovi_verify_webhook_hmac`: valida HMAC do webhook usando `sha1` + base64 e o header `X-OpenPix-Signature`.

---

## Fluxos recomendados

### Pix via Pagar.me (preferência atual)

1. (opcional) `pagarme_create_customer` (aluno)
2. `pagarme_create_recipient` (personal)
3. `pagarme_create_order_pix_split` → retorna `chargeId` e `pix.qrCode/qrCodeUrl/expiresAt`
4. Polling de status com `pagarme_get_charge` / `pagarme_get_order`

### Pix via Woovi/OpenPix (alternativo)

1. `woovi_create_charge` → retorna `charge.brCode`, `charge.qrCodeImage`, `charge.paymentLinkUrl`
2. `woovi_get_charge` / `woovi_list_charges` → acompanhar status
3. Se precisar estornar: `woovi_create_refund` (com `transactionEndToEndId`)

### Cartão via Pagar.me

1. (opcional) `pagarme_create_card_token` → obtém `card_token`
2. `pagarme_create_order_credit_card_split` (usa `cardToken` ou `cardId`)
3. Se `capture=false`: `pagarme_capture_charge`
4. Cancelamento/estorno: `pagarme_cancel_charge`

---

## Exemplos de payloads (copiar/colar)

### Pagar.me — Pix + split 100%

```json
{
  "recipientId": "rp_xxxxxxxxxx",
  "items": [
    { "amount": 15000, "description": "Mensalidade", "quantity": 1 }
  ],
  "customer": {
    "name": "Aluno Exemplo",
    "email": "aluno@exemplo.com",
    "document": "98765432100",
    "type": "individual",
    "address": {
      "street": "Rua Exemplo",
      "number": "100",
      "zipCode": "01001000",
      "neighborhood": "Centro",
      "city": "São Paulo",
      "state": "SP",
      "country": "BR"
    }
  },
  "pix": { "expiresIn": 3600 },
  "idempotencyKey": "order-pix-pay_001"
}
```

### Pagar.me — tokenização (card_token)

```json
{
  "publicKey": "pk_xxxxxxxxxx",
  "card": {
    "number": "4111111111111111",
    "holderName": "ALUNO EXEMPLO",
    "expMonth": 12,
    "expYear": 2030,
    "cvv": "123",
    "brand": "visa",
    "label": "Blah"
  },
  "idempotencyKey": "token-stu_123"
}
```

### Pagar.me — Cartão + split 100%

```json
{
  "recipientId": "rp_xxxxxxxxxx",
  "items": [
    { "amount": 15000, "description": "Mensalidade", "quantity": 1 }
  ],
  "customer": {
    "name": "Aluno Exemplo",
    "email": "aluno@exemplo.com",
    "document": "98765432100",
    "type": "individual",
    "address": {
      "street": "Rua Exemplo",
      "number": "100",
      "zipCode": "01001000",
      "neighborhood": "Centro",
      "city": "São Paulo",
      "state": "SP",
      "country": "BR"
    }
  },
  "creditCard": {
    "capture": true,
    "installments": 1,
    "statementDescriptor": "Blah",
    "cardToken": "card_tok_xxx"
  },
  "idempotencyKey": "order-cc-pay_002"
}
```

### Woovi/OpenPix — criar charge Pix

```json
{
  "correlationID": "pay_123",
  "value": 15000,
  "comment": "Mensalidade",
  "customer": {
    "name": "Aluno Exemplo",
    "email": "aluno@exemplo.com",
    "phone": "+5511999999999",
    "taxID": "471.737.080-52"
  }
}
```

### Woovi/OpenPix — refund

```json
{
  "transactionEndToEndId": "E1234567...",
  "correlationID": "refund_pay_123",
  "value": 15000,
  "comment": "Estorno"
}
```

### Woovi/OpenPix — validar webhook (HMAC)

```json
{
  "secret": "hmac-secret-key",
  "signature": "jgR2XF0PKDiAwHP1s+TryvxMySQ=",
  "body": "{\"event\":\"OPENPIX:CHARGE_COMPLETED\"}"
}
```

---

## Referências (Context7)

- OpenPix/Woovi — charges/refunds/webhook HMAC: `developers_openpix_br` (docs em `api.md` e `docs/webhook/seguranca/webhook-hmac.md`)
- Pagar.me — SDK Node: `pagarme/pagarme-nodejs-sdk`
- MCP TypeScript SDK: `modelcontextprotocol/typescript-sdk`


### Autor

**Luiz Pillon**.