import { useRouter } from "@tanstack/react-router";

/**
 * Path-string navigate helper so ported Software Vala screens keep their
 * original `navigate('/path')` / `navigate(-1)` call style on top of
 * TanStack Router.
 */
export const useNavigate = () => {
  const router = useRouter();
  return (to: string | number, options?: { replace?: boolean }) => {
    if (typeof to === "number") {
      void router.history.go(to);
      return;
    }
    void router.navigate({ to, replace: options?.replace ?? false } as never);
  };
};

export default useNavigate;
