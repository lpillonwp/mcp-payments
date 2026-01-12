import {
  ChargesController,
  Client,
  CustomersController,
  OrdersController,
  RecipientsController,
  TokensController,
} from "@pagarme/pagarme-nodejs-sdk";

export type PagarmeControllers = {
  client: Client;
  orders: OrdersController;
  charges: ChargesController;
  customers: CustomersController;
  recipients: RecipientsController;
  tokens: TokensController;
};

let cached: PagarmeControllers | null = null;

export function getPagarmeControllers(): PagarmeControllers {
  if (cached) return cached;

  const apiKey = process.env.PAGARME_API_KEY;
  if (!apiKey) throw new Error("PAGARME_API_KEY not defined.");

  const client = new Client({
    basicAuthCredentials: { username: apiKey, password: "" },
    serviceRefererName: "payments-integration-mcp",
    timeout: 0,
  });

  cached = {
    client,
    orders: new OrdersController(client),
    charges: new ChargesController(client),
    customers: new CustomersController(client),
    recipients: new RecipientsController(client),
    tokens: new TokensController(client),
  };

  return cached;
}


