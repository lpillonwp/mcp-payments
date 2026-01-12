import axios, { type AxiosInstance } from "axios";

export type WooviClient = {
  http: AxiosInstance;
  baseUrl: string;
  appId: string;
};

let cached: WooviClient | null = null;

function getWooviBaseUrl(): string {
  return process.env.WOOVI_BASE_URL?.replace(/\/$/, "") ?? "";
}

export function getWooviClient(): WooviClient {
  if (cached) return cached;

  const appId = process.env.WOOVI_APP_ID;
  if (!appId) {
    throw new Error("WOOVI_APP_ID Not Defined.");
  }

  const baseUrl = getWooviBaseUrl();
  const http = axios.create({
    baseURL: baseUrl,
    headers: {
      Authorization: appId,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  cached = { http, baseUrl, appId };
  return cached;
}


