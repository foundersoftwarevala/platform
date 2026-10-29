import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  addVpsApiAccount,
  checkVpsApiAccountEndpoint,
  listVpsApiAccounts,
  setVpsApiAccountStatus,
} from "./ai-api-accounts.functions";

async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Manager authentication required.");
  return token;
}

export function useVpsApiAccounts() {
  const list = useServerFn(listVpsApiAccounts);
  return useQuery({
    queryKey: ["ai-api-manager", "vps-accounts"],
    queryFn: async () => list({ data: { accessToken: await accessToken() } }),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}

function useAccountMutation<TVariables extends object, TResult>(
  mutation: (data: TVariables & { accessToken: string }) => Promise<TResult>,
  successMessage: (result: TResult) => string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: TVariables) =>
      mutation({ ...variables, accessToken: await accessToken() }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["ai-api-manager", "vps-accounts"] });
      toast.success(successMessage(result));
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useAddVpsApiAccount() {
  const add = useServerFn(addVpsApiAccount);
  return useAccountMutation(
    (input) => add({ data: input }),
    () => "Credential account added to VPS Postgres.",
  );
}

export function useSetVpsApiAccountStatus() {
  const setStatus = useServerFn(setVpsApiAccountStatus);
  return useAccountMutation(
    (input) => setStatus({ data: input }),
    (result) => `Credential ${result.status}.`,
  );
}

export function useCheckVpsApiAccountEndpoint() {
  const check = useServerFn(checkVpsApiAccountEndpoint);
  return useAccountMutation(
    (input) => check({ data: input }),
    (result) => result.detail,
  );
}
