import { useEffect, useRef, useState } from "react";

/**
 * Whether the browser currently believes it has a network.
 *
 * The same `navigator.onLine` plus online/offline listeners the command centre
 * already uses, lifted into a hook so the checkout can use it too rather than a
 * fourth copy being written inline.
 *
 * It is used for one thing only, and the limit is worth stating: this stops a
 * customer starting a payment while their connection is plainly gone, which
 * saves them a confusing failure. It is **not** used to decide anything about a
 * payment already in flight. `navigator.onLine` only reports whether the device
 * has a network interface — it goes true again the moment Wi-Fi reconnects,
 * long before it means our server is reachable — so treating it as evidence
 * that a payment did or did not happen would be exactly the wrong conclusion.
 * Nothing here retries a financial mutation on reconnect. Recovering a payment
 * whose outcome is unknown is the server's job, through the status endpoint.
 *
 * It starts as `true` deliberately. During server rendering and on the first
 * paint there is no navigator to ask, and assuming a customer is offline would
 * disable a working checkout button for a moment on every single load.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const read = () => {
      try {
        setOnline(navigator.onLine !== false);
      } catch {
        // A browser that will not answer is assumed connected; refusing to let
        // somebody pay because of a failed feature check is the worse error.
        setOnline(true);
      }
    };

    read();
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => {
      window.removeEventListener("online", read);
      window.removeEventListener("offline", read);
    };
  }, []);

  return online;
}

/**
 * Run one authoritative read again when the connection comes back.
 *
 * This is the other half of §13, and the distinction it draws is the whole
 * point. A connection returning is not evidence that anything happened while it
 * was gone — it is only permission to go and ask. So this fires on the
 * `offline → online` edge and nothing else, and what the caller does with it
 * must be a **read** of authoritative state: what does the server say this
 * order's status is, what does it say this customer has bought.
 *
 * It must never be used to retry a financial mutation. A payment whose outcome
 * is unknown is recovered by the server through the status endpoint, which asks
 * the provider; a browser that reconnects and re-POSTs would be guessing with
 * somebody's money.
 *
 * Only the edge fires, never the initial state, because a page that loads while
 * already online has just done its first read and does not need a second one.
 * The callback is held in a ref so a caller passing an inline arrow does not
 * re-register the listeners on every render — that was the shape that quietly
 * accumulated duplicate listeners (§31).
 */
export function useOnlineRecovery(onRecover: () => void): void {
  const latest = useRef(onRecover);
  latest.current = onRecover;

  useEffect(() => {
    // Whether we have actually seen the connection go away. Without this, some
    // browsers firing a spurious `online` event on load would trigger a second
    // read of everything for no reason.
    let wasOffline = false;
    try {
      wasOffline = navigator.onLine === false;
    } catch {
      wasOffline = false;
    }

    const goneOffline = () => {
      wasOffline = true;
    };
    const comeBack = () => {
      if (!wasOffline) return;
      wasOffline = false;
      latest.current();
    };

    window.addEventListener("offline", goneOffline);
    window.addEventListener("online", comeBack);
    return () => {
      window.removeEventListener("offline", goneOffline);
      window.removeEventListener("online", comeBack);
    };
  }, []);
}
