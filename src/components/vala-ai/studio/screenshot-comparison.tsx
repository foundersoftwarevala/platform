import { useRef, useState, type ChangeEvent } from "react";
import {
  Columns2,
  Layers,
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Link2,
  Download,
} from "lucide-react";
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { Button } from "@/components/vala-ai/studio/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/vala-ai/studio/ui/dialog";
import { Slider } from "@/components/vala-ai/studio/ui/slider";
import previewImg from "@/assets/vala-ai-studio/preview-checkout.jpg";

type Shot = { src: string; name: string };

export function ScreenshotComparison({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reference, setReference] = useState<Shot | null>(null);
  const [current, setCurrent] = useState<Shot>({ src: previewImg, name: "Checkout preview" });
  const [mode, setMode] = useState<"side" | "overlay">("side");
  const [opacity, setOpacity] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const left = useRef<ReactZoomPanPinchRef | null>(null);
  const right = useRef<ReactZoomPanPinchRef | null>(null);
  const syncing = useRef(false);
  const referenceInput = useRef<HTMLInputElement | null>(null);
  const currentInput = useRef<HTMLInputElement | null>(null);

  const sync = (source: ReactZoomPanPinchRef, target: ReactZoomPanPinchRef | null) => {
    setZoom(source.state.scale);
    if (!target || syncing.current) return;
    const { positionX, positionY, scale } = source.state;
    if (
      target.state.scale === scale &&
      target.state.positionX === positionX &&
      target.state.positionY === positionY
    )
      return;
    syncing.current = true;
    void target.setTransform(positionX, positionY, scale, 0);
    syncing.current = false;
  };

  const reset = () => {
    void left.current?.setTransform(0, 0, 1, 0);
    void right.current?.setTransform(0, 0, 1, 0);
    setZoom(1);
  };

  const upload = (event: ChangeEvent<HTMLInputElement>, slot: "reference" | "current") => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) {
      setError("Choose an image under 20 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setError("The screenshot could not be opened.");
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const src = reader.result;
      const image = new Image();
      image.onerror = () => setError("This image format could not be opened.");
      image.onload = () => {
        const shot = { src, name: file.name };
        if (slot === "reference") setReference(shot);
        else setCurrent(shot);
        setError("");
        reset();
      };
      image.src = src;
    };
    reader.readAsDataURL(file);
  };

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolvePromise, rejectPromise) => {
      const image = new Image();
      image.onload = () => resolvePromise(image);
      image.onerror = () => rejectPromise(new Error("load"));
      image.src = src;
    });

  const exportReport = async () => {
    setExporting(true);
    setError("");
    try {
      const shots = [reference, current].filter((shot): shot is Shot => Boolean(shot));
      const images = await Promise.all(shots.map((shot) => loadImage(shot.src)));
      const panelWidth = 760;
      const pad = 32;
      const header = 96;
      const labelHeight = 28;
      const scaleFor = (image: HTMLImageElement) => panelWidth / image.naturalWidth;
      const panels: {
        title: string;
        draw: (ctx: CanvasRenderingContext2D, x: number, y: number) => number;
      }[] = [];

      shots.forEach((shot, index) => {
        const image = images[index]!;
        const height = image.naturalHeight * scaleFor(image);
        panels.push({
          title: index === 0 ? `Reference — ${shot.name}` : `Current — ${shot.name}`,
          draw: (ctx, x, y) => {
            ctx.drawImage(image, x, y, panelWidth, height);
            return height;
          },
        });
      });

      if (reference && current) {
        const [refImage, curImage] = images as [HTMLImageElement, HTMLImageElement];
        const height = refImage.naturalHeight * scaleFor(refImage);
        panels.push({
          title: `Overlay — current at ${opacity}% opacity`,
          draw: (ctx, x, y) => {
            ctx.drawImage(refImage, x, y, panelWidth, height);
            ctx.globalAlpha = opacity / 100;
            ctx.drawImage(
              curImage,
              x,
              y,
              panelWidth,
              (curImage.naturalHeight / curImage.naturalWidth) * panelWidth,
            );
            ctx.globalAlpha = 1;
            return height;
          },
        });
      }

      const columns = Math.min(panels.length, 2);
      const rows = Math.ceil(panels.length / columns);
      const panelHeights = panels.map((panel) => {
        const canvas = document.createElement("canvas");
        return panel.draw(canvas.getContext("2d")!, 0, 0) || 0;
      });
      const maxRowHeights = Array.from({ length: rows }, (_, row) =>
        Math.max(
          ...panels
            .slice(row * columns, row * columns + columns)
            .map((_, i) => panelHeights[row * columns + i] ?? 0),
        ),
      );
      const width = pad * 2 + columns * panelWidth + (columns - 1) * pad;
      const height =
        header + pad + rows * (labelHeight + pad) + maxRowHeights.reduce((a, b) => a + b, 0);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.fillStyle = "#0b0e14";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#e6e9ef";
      ctx.font = "600 24px system-ui, sans-serif";
      ctx.fillText("Checkout comparison report", pad, pad + 8);
      ctx.fillStyle = "#8b93a3";
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillText(
        `Mode: ${mode === "side" ? "Side by side" : "Overlay"} · Overlay opacity: ${opacity}% · Zoom: ${Math.round(zoom * 100)}% · ${new Date().toLocaleString()}`,
        pad,
        pad + 34,
      );

      let y = header;
      for (let row = 0; row < rows; row++) {
        let x = pad;
        for (let col = 0; col < columns; col++) {
          const panel = panels[row * columns + col];
          if (!panel) continue;
          ctx.fillStyle = "#8b93a3";
          ctx.font = "12px system-ui, sans-serif";
          ctx.fillText(panel.title, x, y + 14);
          ctx.strokeStyle = "#2a3040";
          ctx.strokeRect(
            x - 1,
            y + labelHeight - 1,
            panelWidth + 2,
            (panelHeights[row * columns + col] ?? 0) + 2,
          );
          panel.draw(ctx, x, y + labelHeight);
          x += panelWidth + pad;
        }
        y += labelHeight + (maxRowHeights[row] ?? 0) + pad;
      }

      const blob = await new Promise<Blob | null>((resolvePromise) =>
        canvas.toBlob(resolvePromise, "image/png"),
      );
      if (!blob) throw new Error("blob");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "checkout-comparison-report.png";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("The report could not be exported.");
    } finally {
      setExporting(false);
    }
  };

  const pane = (slot: "reference" | "current") => {
    const shot = slot === "reference" ? reference : current;
    return (
      <section
        className="flex min-h-0 min-w-0 flex-col overflow-hidden border border-studio-line bg-studio-panel"
        aria-label={slot === "reference" ? "Reference screenshot pane" : "Current screenshot pane"}
      >
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-studio-line px-3">
          <span className="text-xs font-medium">
            {mode === "overlay" ? "Overlay" : slot === "reference" ? "Reference" : "Current"}
          </span>
          <span className="min-w-0 truncate font-mono text-[10px] text-studio-faint">
            {mode === "overlay" ? "Reference + current" : (shot?.name ?? "No screenshot")}
          </span>
        </div>
        <div className="comparison-canvas min-h-0 flex-1 overflow-hidden">
          {shot ? (
            <TransformWrapper
              key={`${mode}-${slot}`}
              ref={slot === "reference" ? left : right}
              minScale={0.5}
              maxScale={8}
              limitToBounds={false}
              wheel={{ step: 0.1 }}
              panning={{ velocityDisabled: true }}
              onTransform={(ref) =>
                sync(
                  ref,
                  mode === "overlay" ? null : slot === "reference" ? right.current : left.current,
                )
              }
            >
              <TransformComponent
                wrapperClass="comparison-viewport"
                contentClass="comparison-content"
              >
                <div className="relative w-full">
                  <img
                    src={shot.src}
                    alt={
                      slot === "reference"
                        ? "Reference checkout screenshot"
                        : "Current checkout screenshot"
                    }
                    draggable={false}
                    className="block h-auto w-full select-none"
                  />
                  {mode === "overlay" && (
                    <img
                      src={current.src}
                      alt="Current checkout overlay"
                      draggable={false}
                      className="absolute inset-x-0 top-0 h-auto w-full select-none"
                      style={{ opacity: opacity / 100 }}
                    />
                  )}
                </div>
              </TransformComponent>
            </TransformWrapper>
          ) : (
            <div className="flex h-full min-h-40 items-center justify-center">
              <Button variant="outline" size="sm" onClick={() => referenceInput.current?.click()}>
                <Upload />
                Upload reference
              </Button>
            </div>
          )}
        </div>
      </section>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="comparison-dialog flex h-[90dvh] w-[96vw] max-w-[1400px] flex-col gap-3 overflow-hidden p-4">
        <div className="pr-8">
          <DialogTitle className="font-studio-display uppercase tracking-normal">
            Checkout comparison
          </DialogTitle>
          <DialogDescription className="sr-only">
            Compare reference and current checkout screenshots.
          </DialogDescription>
        </div>
        <input
          ref={referenceInput}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Upload reference screenshot"
          onChange={(event) => upload(event, "reference")}
        />
        <input
          ref={currentInput}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Upload current screenshot"
          onChange={(event) => upload(event, "current")}
        />
        <div className="flex flex-wrap items-center gap-2 border-y border-studio-line py-2">
          <div className="flex gap-1" role="group" aria-label="Comparison mode">
            <Button
              size="sm"
              variant={mode === "side" ? "secondary" : "ghost"}
              aria-pressed={mode === "side"}
              onClick={() => {
                setMode("side");
                reset();
              }}
            >
              <Columns2 />
              Side by side
            </Button>
            <Button
              size="sm"
              variant={mode === "overlay" ? "secondary" : "ghost"}
              aria-pressed={mode === "overlay"}
              disabled={!reference}
              onClick={() => {
                setMode("overlay");
                reset();
              }}
            >
              <Layers />
              Overlay
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => referenceInput.current?.click()}>
            <Upload />
            Reference
          </Button>
          <Button variant="outline" size="sm" onClick={() => currentInput.current?.click()}>
            <Upload />
            Current
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={() => void exportReport()}
          >
            <Download />
            {exporting ? "Exporting…" : "Export report"}
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <Link2 className="mr-1 size-4 text-accent" aria-label="Linked zoom and pan" />
            <Button
              variant="ghost"
              size="icon"
              title="Zoom out"
              aria-label="Zoom out"
              onClick={() => void (left.current ?? right.current)?.zoomOut(0.2, 0)}
            >
              <ZoomOut />
            </Button>
            <output className="w-14 text-center font-mono text-xs" aria-label="Zoom level">
              {Math.round(zoom * 100)}%
            </output>
            <Button
              variant="ghost"
              size="icon"
              title="Zoom in"
              aria-label="Zoom in"
              onClick={() => void (left.current ?? right.current)?.zoomIn(0.2, 0)}
            >
              <ZoomIn />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Reset zoom and pan"
              aria-label="Reset zoom and pan"
              onClick={reset}
            >
              <RotateCcw />
            </Button>
          </div>
        </div>
        {mode === "overlay" && (
          <div className="flex items-center gap-3">
            <label htmlFor="overlay-opacity" className="text-xs text-studio-dim">
              Current opacity
            </label>
            <Slider
              id="overlay-opacity"
              aria-label="Current overlay opacity"
              className="max-w-64"
              min={0}
              max={100}
              step={1}
              value={[opacity]}
              onValueChange={(value) => setOpacity(value[0] ?? 50)}
            />
            <output className="w-10 font-mono text-xs">{opacity}%</output>
          </div>
        )}
        {error && (
          <p role="alert" className="text-xs text-studio-fail">
            {error}
          </p>
        )}
        <div
          className={`grid min-h-0 flex-1 gap-3 ${mode === "side" ? "grid-cols-2" : "grid-cols-1"}`}
        >
          {pane("reference")}
          {mode === "side" && pane("current")}
        </div>
      </DialogContent>
    </Dialog>
  );
}
