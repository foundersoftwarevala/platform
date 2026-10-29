import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  checkVpsAiServiceHealth,
  insertVpsAiRegistryRecord,
  listVpsAiRegistry,
  testVpsAiService,
  updateVpsAiRegistryRecord,
} from "./ai-api-vps.functions";

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Manager authentication required.");
  return token;
}

export function useVpsAiRegistry() {
  const list = useServerFn(listVpsAiRegistry);
  return useQuery({
    queryKey: ["ai-api-manager", "vps-registry"],
    queryFn: async () => list({ data: { accessToken: await getAccessToken() } }),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}

function useAiRegistryMutation<TInput extends object, TResult>(
  run: (input: TInput & { accessToken: string }) => Promise<TResult>,
  success: string | ((result: TResult) => string),
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TInput) => run({ ...input, accessToken: await getAccessToken() }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["ai-api-manager"] });
      toast.success(typeof success === "string" ? success : success(result));
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useInsertVpsAiRegistryRecord() {
  const insert = useServerFn(insertVpsAiRegistryRecord);
  return useAiRegistryMutation((input) => insert({ data: input }), "Saved to VPS Postgres.");
}

export function useUpdateVpsAiRegistryRecord() {
  const update = useServerFn(updateVpsAiRegistryRecord);
  return useAiRegistryMutation((input) => update({ data: input }), "VPS registry updated.");
}

export function useCheckVpsAiServiceHealth() {
  const check = useServerFn(checkVpsAiServiceHealth);
  return useAiRegistryMutation(
    (input) => check({ data: input }),
    (result) => result.detail,
  );
}

export function useTestVpsAiService() {
  const test = useServerFn(testVpsAiService);
  return useAiRegistryMutation(
    (input) => test({ data: input }),
    (result) =>
      `Live test succeeded via ${result.service} (${result.model}), ${result.latencyMs}ms — "${result.responsePreview}"`,
  );
}
