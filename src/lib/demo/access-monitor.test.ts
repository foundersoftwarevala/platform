// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { demoLoginMonitorScript, monitorDemoLogin } from "./access-monitor";

it("reports only visible clickable Super Admin login options, including lazy screens", async () => {
  document.body.innerHTML =
    "<h1>Super Admin</h1><button>Sign In</button><button hidden>Super Admin</button>";
  const send = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
  const stop = monitorDemoLogin();
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  try {
    expect(send).toHaveBeenLastCalledWith(
      { type: "sv-demo-login-options", oneClickSuperAdmin: false },
      "https://softwarevala.net",
    );
    document.body.insertAdjacentHTML(
      "beforeend",
      '<button aria-label="Super Admin">Login</button>',
    );
    await settle();
    expect(send).toHaveBeenLastCalledWith(
      { type: "sv-demo-login-options", oneClickSuperAdmin: true },
      "https://softwarevala.net",
    );
    document.querySelector('[aria-label="Super Admin"]')?.remove();
    await settle();
    expect(send).toHaveBeenLastCalledWith(
      { type: "sv-demo-login-options", oneClickSuperAdmin: false },
      "https://softwarevala.net",
    );
    document.body.innerHTML = "<button>Operator</button><button>Admin settings</button>";
    await settle();
    expect(send).toHaveBeenLastCalledWith(
      { type: "sv-demo-login-options", oneClickSuperAdmin: false },
      "https://softwarevala.net",
    );
  } finally {
    stop();
    send.mockRestore();
  }
});

it("recognizes rich primary role labels without matching descriptions or disabled controls", async () => {
  document.body.innerHTML =
    "<button><p>Super Admin</p><p>Full system control</p><span>Verify license to login</span></button>";
  const send = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
  const stop = monitorDemoLogin();
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  try {
    expect(send).toHaveBeenLastCalledWith(
      { type: "sv-demo-login-options", oneClickSuperAdmin: true },
      "https://softwarevala.net",
    );
    document.body.innerHTML = "<button><p>Manage users</p><span>Super Admin</span></button>";
    await settle();
    expect(send).toHaveBeenLastCalledWith(
      { type: "sv-demo-login-options", oneClickSuperAdmin: false },
      "https://softwarevala.net",
    );
    document.body.innerHTML =
      '<button disabled>Super Admin</button><button aria-disabled="true">Super Admin</button><button aria-label="Manage users"><p>Super Admin</p></button>';
    await settle();
    expect(send).toHaveBeenLastCalledWith(
      { type: "sv-demo-login-options", oneClickSuperAdmin: false },
      "https://softwarevala.net",
    );
  } finally {
    stop();
    send.mockRestore();
  }
});

it("serializes an executable browser monitor with no access details", () => {
  const script = demoLoginMonitorScript();
  expect(script).toContain('id="sv-demo-login-options"');
  expect(script).not.toContain("DEMO_ACCESS_DETAILS");
  expect(() => new Function(script.replace(/^<script[^>]*>|<\/script>$/g, ""))).not.toThrow();
});
