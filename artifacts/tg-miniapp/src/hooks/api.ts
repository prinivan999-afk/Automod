import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  customFetch,
  setAuthTokenGetter,
  type AutomodStats,
  type AutomodSettings,
  type SaveAutomodSettingsBody,
  type BusinessConnection,
  type AutomodMessage,
} from "@workspace/api-client-react";

export function initApiAuth() {
  setAuthTokenGetter(() => localStorage.getItem("automod_api_token"));
}

const getHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("automod_api_token");
  return token ? { "x-api-token": token } : {};
};

export function useGetAutomodStats() {
  return useQuery({
    queryKey: ["automod-stats"],
    queryFn: () => customFetch<AutomodStats>("/api/automod/stats", { headers: getHeaders() }),
  });
}

export function useGetAutomodSettings() {
  return useQuery({
    queryKey: ["automod-settings"],
    queryFn: () => customFetch<AutomodSettings>("/api/automod/settings", { headers: getHeaders() }),
  });
}

export function useSaveAutomodSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveAutomodSettingsBody) =>
      customFetch<AutomodSettings>("/api/automod/settings", {
        method: "POST",
        headers: { ...getHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["automod-settings"], data);
    },
  });
}

export function useListAutomodConnections() {
  return useQuery({
    queryKey: ["automod-connections"],
    queryFn: () =>
      customFetch<BusinessConnection[]>("/api/automod/connections", { headers: getHeaders() }),
  });
}

export function useToggleAutomodConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isEnabled }: { id: number; isEnabled: boolean }) =>
      customFetch<BusinessConnection>(`/api/automod/connections/${id}/toggle`, {
        method: "PATCH",
        headers: { ...getHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled }),
      }),
    onSuccess: (updatedConnection) => {
      queryClient.setQueryData(["automod-connections"], (old: BusinessConnection[] | undefined) => {
        if (!old) return old;
        return old.map((c) => (c.id === updatedConnection.id ? updatedConnection : c));
      });
      queryClient.invalidateQueries({ queryKey: ["automod-stats"] });
    },
  });
}

export function useGetAutomodActivity() {
  return useQuery({
    queryKey: ["automod-activity"],
    queryFn: () => customFetch<AutomodMessage[]>("/api/automod/activity", { headers: getHeaders() }),
  });
}
