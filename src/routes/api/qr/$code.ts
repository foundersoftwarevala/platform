import { createFileRoute } from "@tanstack/react-router";

/**
 * The QR image, rendered server-side.
 *
 * Section 46 asks for a production QR generator rather than a picture of one.
 * The `qrcode` package is already a dependency of this project, so the image is
 * produced here from the URL the database says this QR encodes — never from
 * anything in the request. A caller cannot make this render a QR for an
 * arbitrary destination, because the destination is not an input.
 *
 * GET /api/qr/{code}.png   — PNG at the configured size
 * GET /api/qr/{code}.svg   — SVG, for print
 * GET /api/qr/{code}       — PNG
 *
 * A scan is recorded by /s/{code} when somebody follows the encoded link, not
 * by rendering the image; rendering it in the console is not a scan.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export const Route = createFileRoute("/api/qr/$code")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const raw = String((params as { code?: string }).code ?? "").trim();
        const svg = raw.toLowerCase().endsWith(".svg");
        const code = raw.replace(/\.(png|svg)$/i, "");

        if (!code || !/^[A-Za-z0-9]{4,24}$/.test(code)) {
          return Response.json({ error: "Not a valid QR code" }, { status: 404 });
        }
        if (!url()) {
          return Response.json({ error: "Not configured" }, { status: 503 });
        }

        let row:
          | {
              target_url: string; foreground: string; background: string;
              size: number; error_correction: string; quiet_zone: number;
            }
          | undefined;
        try {
          const res = await fetch(
            `${url()}/rest/v1/product_qr_codes` +
              `?select=target_url,foreground,background,size,error_correction,quiet_zone` +
              `&qr_code=eq.${encodeURIComponent(code)}&active=is.true&limit=1`,
            { headers: admin() },
          );
          if (!res.ok) return Response.json({ error: "Could not read the QR" }, { status: 502 });
          row = ((await res.json()) as (typeof row)[])[0];
        } catch {
          return Response.json({ error: "Could not read the QR" }, { status: 502 });
        }

        if (!row) return Response.json({ error: "No such QR code" }, { status: 404 });

        const QR = await import("qrcode");
        const options = {
          errorCorrectionLevel: (row.error_correction ?? "M") as "L" | "M" | "Q" | "H",
          margin: row.quiet_zone ?? 4,
          width: Math.min(Math.max(row.size ?? 512, 64), 2048),
          color: { dark: row.foreground ?? "#00D0FF", light: row.background ?? "#FFFFFF" },
        };

        try {
          if (svg) {
            const markup = await QR.toString(row.target_url, { ...options, type: "svg" });
            return new Response(markup, {
              headers: {
                "content-type": "image/svg+xml; charset=utf-8",
                // The encoded URL is stable while the QR is active, so this is
                // safe to cache; a regenerated QR gets a new code.
                "cache-control": "public, max-age=86400",
              },
            });
          }
          const png = await QR.toBuffer(row.target_url, { ...options, type: "png" });
          return new Response(new Uint8Array(png), {
            headers: {
              "content-type": "image/png",
              "cache-control": "public, max-age=86400",
            },
          });
        } catch (error) {
          // A QR that could not be drawn is an error, not a blank image.
          return Response.json(
            {
              error: "The QR could not be rendered",
              detail: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
