import { createTuyau } from "@tuyau/client";
import { api } from "../../web/.adonisjs/api";
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * attempt, 5000),
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
  },
});

export const tuyau = createTuyau({
  api,
  baseUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:3333",
  headers: {
    Accept: "application/json",
    "Content-type": "application/json",
  },
});
