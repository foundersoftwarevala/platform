import { useNavigate as useRouterNavigate, useLocation as useRouterLocation } from "@tanstack/react-router";

/**
 * Path-string navigation helper so ported screens can keep calling
 * `navigate("/support/tickets")` while the app uses TanStack Router.
 */
export function useNavigate() {
  const navigate = useRouterNavigate();
  return (to: string | number, options?: { replace?: boolean }) => {
    if (typeof to === "number") {
      if (typeof window !== "undefined") window.history.go(to);
      return;
    }
    navigate({ to, replace: options?.replace, ignoreBlocker: true } as never);
  };
}

export function useLocation() {
  return useRouterLocation();
}
