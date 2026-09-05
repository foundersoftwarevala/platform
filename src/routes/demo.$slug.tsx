import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { resolveDemoUrl, BRANDING_CONFIG } from "@/lib/demo-gateway";
import { getPublicProduct, recordPublicDemoClick } from "@/lib/marketplace.functions";
import { useServerFn } from "@/lib/serverFn";
import { AlertCircle, Loader, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/demo/$slug")({
  component: DemoBrandedGatewayPage,
});

function DemoBrandedGatewayPage() {
  // Extract slug from URL - TanStack Router params seem to have issues
  const [slug, setSlug] = useState<string>("");
  
  useEffect(() => {
    const pathname = window.location.pathname;
    const match = pathname.match(/^\/demo\/([^\/]+)/);
    const extractedSlug = match?.[1] || "";
    console.log('[demo-gateway] Extracted slug from URL:', extractedSlug, 'from pathname:', pathname);
    setSlug(extractedSlug);
  }, []);
  
  const getProductFn = useServerFn(getPublicProduct);
  const recordClickFn = useServerFn(recordPublicDemoClick);
  const clickRecorded = useRef(false);
  const [demoUrl, setDemoUrl] = useState<string | null>(null);
  const [demoName, setDemoName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSafeUrl, setIsSafeUrl] = useState(false);
  const [isEmbeddable, setIsEmbeddable] = useState(true);

  // Fetch product and demo information from Marketplace API
  const { data: productData, isLoading } = useQuery({
    queryKey: ["marketplace-product-demo", slug],
    queryFn: async () => {
      try {
        if (!slug) {
          console.warn('[demo-gateway] Slug is undefined');
          return null;
        }
        const result = await getProductFn({ data: { slug } });
        return result;
      } catch (error) {
        console.error(`[demo-gateway-${slug}] Error loading product:`, error);
        return null;
      }
    },
    enabled: !!slug, // Only run query when slug is available
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Only an active database relation can make a demo launchable.
  const activeDemo = useMemo(() => {
    return productData?.active_demos?.find((demo) => demo.status === "active") ?? null;
  }, [productData?.active_demos]);

  useEffect(() => {
    if (clickRecorded.current || !productData?.product?.id || !activeDemo?.id) return;
    clickRecorded.current = true;
    void recordClickFn({
      data: {
        productId: productData.product.id,
        demoUrlId: activeDemo.id,
        sourcePage: window.location.pathname,
        referrer: document.referrer || undefined,
        deviceType: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
        browser: navigator.userAgent.slice(0, 120),
      },
    }).catch(() => {
      clickRecorded.current = false;
    });
  }, [activeDemo, productData?.product?.id, recordClickFn]);

  // Validate and resolve demo URL
  useEffect(() => {
    const resolve = async () => {
      console.log('[demo-gateway] Resolving demo for slug:', slug);
      if (!activeDemo?.url) {
        setError(`No active demo found for product: ${slug}`);
        return;
      }

      const demoName = activeDemo.demo_name || productData?.product?.name || "Demo";
      setDemoName(demoName);
      console.log('[demo-gateway] Demo name:', demoName);

      // Use the API proxy endpoint with query parameters
      const proxyUrl = `/api/proxy/demo/${slug}`;
      console.log('[demo-gateway] Proxy URL:', proxyUrl);
      console.log('[demo-gateway] Resolving proxy URL:', proxyUrl);
      
      const resolution = await resolveDemoUrl(slug, proxyUrl);
      console.log('[demo-gateway] Resolution result:', resolution);
      
      if (resolution.safe) {
        setDemoUrl(resolution.url);
        setIsSafeUrl(true);
        setIsEmbeddable(resolution.embeddable ?? true);
        setError(null);
        console.log('[demo-gateway] Demo URL set successfully:', resolution.url);
      } else {
        setError(resolution.error || "Demo URL validation failed");
        setDemoUrl(null);
        setIsSafeUrl(false);
        setIsEmbeddable(false);
        console.log('[demo-gateway] Demo URL validation failed:', resolution.error);
      }
    };

    resolve();
  }, [activeDemo, slug, productData?.product?.name]);

  // Set page title and favicon
  useEffect(() => {
    document.title = BRANDING_CONFIG.title;
    
    // Set favicon
    const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (favicon) {
      favicon.href = BRANDING_CONFIG.favicon;
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-linear-to-b from-slate-950 to-slate-900">
        <div className="space-y-4 text-center">
          <Loader className="mx-auto h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm text-slate-400">Loading demo...</p>
        </div>
      </div>
    );
  }

  if (error || !isSafeUrl || !demoUrl) {
    return (
      <div className="flex h-screen flex-col bg-linear-to-b from-slate-950 to-slate-900">
        {/* Header */}
        <div className="border-b border-slate-700 bg-slate-900 px-6 py-4">
          <a
            href="/"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Marketplace
          </a>
        </div>

        {/* Error Content */}
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="space-y-6 max-w-md text-center">
            <div className="flex justify-center">
              <AlertCircle className="h-12 w-12 text-red-500" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">Demo Unavailable</h1>
              <p className="text-slate-400">
                {error || "This demo could not be loaded. Please try again later."}
              </p>
            </div>
            <div className="space-y-2 text-xs text-slate-500">
              <p>Product: <code className="bg-slate-800 px-2 py-1 rounded">{slug}</code></p>
              {demoUrl && (
                <p>Intended URL: <code className="bg-slate-800 px-2 py-1 rounded block break-all">{demoUrl}</code></p>
              )}
            </div>
            <a
              href="/"
              className="inline-block mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              Return to Marketplace
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Success - render branded demo gateway
  if (!isEmbeddable && demoUrl) {
    return (
      <div className="flex h-screen flex-col bg-slate-950">
        <div className="flex h-16 items-center gap-3 border-b border-slate-700 bg-linear-to-r from-slate-900 to-slate-800 px-6 shadow-lg">
          <img
            src={BRANDING_CONFIG.favicon}
            alt="Software Vala™"
            className="h-7 w-7"
          />
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm font-semibold text-white">Software Vala™</span>
            <span className="text-xs text-slate-500">Demo</span>
            <span className="text-xs text-slate-400">—</span>
            <span className="text-xs text-slate-400">{demoName}</span>
          </div>
          <a
            href="/"
            className="ml-auto inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
            title="Back to Marketplace"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </a>
        </div>

        <div className="flex flex-1 items-center justify-center bg-slate-950 px-6">
          <div className="max-w-xl rounded-2xl border border-cyan-500/20 bg-slate-900/80 p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-300">
              <img src={BRANDING_CONFIG.favicon} alt="Software Vala™" className="h-10 w-10" />
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">External Demo</p>
            <h1 className="text-3xl font-bold text-white">{demoName}</h1>
            <p className="mt-4 text-sm text-slate-300">
              This demo is hosted by an external provider that does not allow in-page embedding. Open it in a new tab to continue with the full experience while keeping the Software Vala branded flow.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href={demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                Open Demo in New Tab
              </a>
              <a
                href="/marketplace"
                className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
              >
                Back to Marketplace
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-700 bg-slate-900 px-6 py-2 text-center text-xs text-slate-500">
          <span>Powered by </span>
          <span className="font-semibold text-slate-300">Software Vala™</span>
          <span> — Enterprise Software Solutions</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      {/* Software Vala Branded Header */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-700 bg-linear-to-r from-slate-900 to-slate-800 px-6 shadow-lg">
        <img
          src={BRANDING_CONFIG.favicon}
          alt="Software Vala™"
          className="h-7 w-7"
        />
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm font-semibold text-white">Software Vala™</span>
          <span className="text-xs text-slate-500">Demo</span>
          <span className="text-xs text-slate-400">—</span>
          <span className="text-xs text-slate-400">{demoName}</span>
        </div>
        <a
          href="/"
          className="ml-auto inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          title="Back to Marketplace"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </a>
      </div>

      {/* Demo Container - Iframe with Software Vala Context */}
      <div className="flex-1 overflow-hidden">
        <iframe
          key={demoUrl}
          src={demoUrl}
          title={`Software Vala™ — ${demoName}`}
          className="h-full w-full border-0"
          allow="geolocation;camera;microphone;payment;clipboard-read;clipboard-write"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-presentation"
        />
      </div>

      {/* Footer - Subtle branding */}
      <div className="border-t border-slate-700 bg-slate-900 px-6 py-2 text-center text-xs text-slate-500">
        <span>Powered by </span>
        <span className="font-semibold text-slate-300">Software Vala™</span>
        <span> — Enterprise Software Solutions</span>
      </div>
    </div>
  );
}
