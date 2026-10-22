const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveResellerCustomerOwnerId(
  resellerId: string,
  apiUrl: string,
  headers: Record<string, string>,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  if (!UUID.test(resellerId)) throw new Error("A valid reseller is required.");
  if (!apiUrl.trim()) throw new Error("The reseller database is not configured.");

  const response = await fetcher(`${apiUrl}/rest/v1/rpc/reseller_manager_customer_owner_id`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ p_reseller_id: resellerId }),
  });
  if (!response.ok) {
    throw new Error(`Reseller customer owner lookup failed (${response.status}).`);
  }

  const ownerId: unknown = await response.json();
  if (ownerId === null) return null;
  if (typeof ownerId !== "string" || !UUID.test(ownerId)) {
    throw new Error("The assigned reseller could not be linked to a customer owner.");
  }
  return ownerId;
}
