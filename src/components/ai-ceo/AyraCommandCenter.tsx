import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  ArrowUpRight,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  Globe,
  LoaderCircle,
  Menu,
  Search,
  Send,
  Settings2,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  AYRA_GESTURES,
  AYRA_LOOKS,
  ayraWorldStage,
  type AyraGestureId,
  type AyraLookId,
} from "@/components/ai-ceo/ayra-assets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { getAyraCommandSettings, askAyra, saveAyraCommandSettings } from "@/lib/ayra/functions";
import {
  AYRA_COMMAND_SETTINGS_KEY,
  DEFAULT_AYRA_COMMAND_SETTINGS,
  type AyraCommandSettings,
} from "@/lib/ayra/command-settings";
import { useTranslation } from "@/lib/i18n/use-translation";

const SETTINGS_QUERY_KEY = ["ayra", "command-settings", AYRA_COMMAND_SETTINGS_KEY] as const;

const GOOGLE_SHORTCUTS = [
  { label: "YouTube", url: "https://www.youtube.com", mark: "▶" },
  { label: "Gmail", url: "https://mail.google.com", mark: "M" },
  { label: "Drive", url: "https://drive.google.com", mark: "▲" },
  { label: "Maps", url: "https://maps.google.com", mark: "●" },
  { label: "Translate", url: "https://translate.google.com", mark: "G" },
  { label: "Photos", url: "https://photos.google.com", mark: "✿" },
] as const;

const GESTURES = Object.keys(AYRA_GESTURES) as AyraGestureId[];

function openExternal(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

function findExplicitWebsite(command: string): string | null {
  const match = command.match(/(?:https?:\/\/|www\.)[^\s]+/i)?.[0];
  if (!match) return null;

  try {
    const url = new URL(/^https?:\/\//i.test(match) ? match : `https://${match}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function downloadAnswer(answer: string): void {
  const url = URL.createObjectURL(new Blob([answer], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "ayra-reply.txt";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

type BrowserTab = "browser" | "screenshot" | "download";

export function AyraCommandCenter() {
  const { t } = useTranslation();
  const [lookId, setLookId] = useState<AyraLookId>("default");
  const [gesture, setGesture] = useState<AyraGestureId | null>(null);
  const [command, setCommand] = useState("");
  const [searchText, setSearchText] = useState("");
  const [tab, setTab] = useState<BrowserTab>("browser");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localBrightness, setLocalBrightness] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [failedMotionLook, setFailedMotionLook] = useState<AyraLookId | null>(null);
  const [gestureUnavailable, setGestureUnavailable] = useState(false);
  const greeted = useRef(false);
  const getSettings = useServerFn(getAyraCommandSettings);
  const saveSettings = useServerFn(saveAyraCommandSettings);
  const sendCommand = useServerFn(askAyra);
  const settingsQuery = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => getSettings(),
    staleTime: 60_000,
    retry: false,
  });
  const queryClient = useQueryClient();
  const saveMutation = useMutation({
    mutationFn: (settings: AyraCommandSettings) => saveSettings({ data: settings }),
    onSuccess: (settings) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, settings);
    },
  });
  const commandMutation = useMutation({
    mutationFn: (prompt: string) => sendCommand({ data: { prompt } }),
    onSuccess: () => {
      if (settingsQuery.data?.liveReactions && settingsQuery.data.motionEnabled) {
        setLookId("cyanJacket");
        setGesture("wave");
        setGestureUnavailable(false);
      }
    },
  });

  const settings = settingsQuery.data ?? DEFAULT_AYRA_COMMAND_SETTINGS;
  const selectedLook = AYRA_LOOKS.find((look) => look.id === lookId) ?? AYRA_LOOKS[0];
  const motionEnabled = settingsQuery.data?.motionEnabled === true && !reducedMotion;
  const brightness = localBrightness ?? settings.brightness;
  const reply = commandMutation.data?.answer ?? "";

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (
      greeted.current ||
      !settingsQuery.data ||
      !settingsQuery.data.liveReactions ||
      !motionEnabled
    ) {
      return;
    }
    greeted.current = true;
    setGesture("greet");
  }, [motionEnabled, settingsQuery.data]);

  useEffect(() => {
    setFailedMotionLook(null);
    setGestureUnavailable(false);
  }, [lookId]);

  function submitCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = command.trim();
    if (!prompt || commandMutation.isPending) return;

    const website = findExplicitWebsite(prompt);
    if (website) openExternal(website);
    commandMutation.mutate(prompt);
    setCommand("");
  }

  function searchGoogle(lucky = false) {
    const query = searchText.trim();
    if (!query) return;
    openExternal(
      `https://www.google.com/search?q=${encodeURIComponent(query)}${lucky ? "&btnI=1" : ""}`,
    );
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    searchGoogle();
  }

  function updateSettings(patch: Partial<AyraCommandSettings>) {
    if (!settingsQuery.data || saveMutation.isPending) return;
    saveMutation.mutate({ ...settingsQuery.data, ...patch });
  }

  function selectGesture(nextGesture: AyraGestureId) {
    if (!motionEnabled) return;
    setLookId("cyanJacket");
    setGestureUnavailable(false);
    setGesture(nextGesture);
  }

  return (
    <section aria-label={t("ceo.ayra_command_accessibility")} className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-surface/90 p-3 shadow-lg sm:flex-row sm:items-center">
        <div className="flex shrink-0 items-center gap-3 px-2">
          <Sparkles className="h-8 w-8 text-primary" aria-hidden="true" />
          <div>
            <p className="font-semibold tracking-wide text-foreground" data-no-translate>
              AYRA COMMAND CENTER
            </p>
            <p className="text-xs text-muted-foreground" data-no-translate>
              Software Vala
            </p>
          </div>
        </div>
        <form onSubmit={submitCommand} className="flex min-w-0 flex-1 gap-2">
          <Input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            maxLength={4000}
            placeholder={t("ceo.ayra_command_prompt_placeholder")}
            aria-label={t("ceo.ayra_command_prompt_label")}
            disabled={commandMutation.isPending}
            className="min-w-0"
          />
          <Button
            type="submit"
            disabled={!command.trim() || commandMutation.isPending}
            aria-label={t("ceo.ayra_command_send")}
          >
            {commandMutation.isPending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </form>
        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="gap-2">
                <Menu className="h-4 w-4" aria-hidden="true" />
                {t("ceo.ayra_command_tools_access")}
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => window.location.assign("/control-panel")}>
                {t("ceo.ayra_command_control_panel")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => window.location.assign("/ai-ceo")}>
                {t("ceo.ayra_command_ceo_dashboard")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("ceo.ayra_command_open_settings")}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {commandMutation.isError && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {commandMutation.error instanceof Error
            ? commandMutation.error.message
            : t("ceo.ayra_command_request_failed")}
        </p>
      )}
      {settingsQuery.isError && !settingsOpen && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <span>
            {settingsQuery.error instanceof Error
              ? settingsQuery.error.message
              : t("ceo.ayra_command_settings_failed")}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void settingsQuery.refetch()}
          >
            {t("ceo.ayra_command_retry_settings")}
          </Button>
        </div>
      )}
      {commandMutation.data && (
        <p role="status" className="text-xs text-muted-foreground">
          {t("ceo.ayra_command_inspected", {
            tools: commandMutation.data.toolsUsed.join(", ") || t("ceo.ayra_command_no_tools"),
          })}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden rounded-2xl border-primary/25">
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
              <span data-no-translate>AYRA&apos;S WORLD</span>
            </CardTitle>
            <Badge variant="secondary" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              {commandMutation.isPending
                ? t("ceo.ayra_command_reading")
                : t("ceo.ayra_command_ready")}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className="relative min-h-[30rem] overflow-hidden rounded-xl border border-border bg-slate-950 sm:min-h-[34rem]"
              style={{ filter: `brightness(${0.3 + (brightness / 100) * 0.7})` }}
            >
              <img
                src={ayraWorldStage}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <img
                key={selectedLook.id}
                src={selectedLook.scene}
                alt={selectedLook.name}
                className="absolute inset-0 h-full w-full object-cover object-[center_18%]"
              />
              {motionEnabled && selectedLook.motion && failedMotionLook !== selectedLook.id && (
                <video
                  key={selectedLook.motion}
                  src={selectedLook.motion}
                  poster={selectedLook.scene}
                  muted
                  playsInline
                  autoPlay
                  loop
                  preload="metadata"
                  aria-hidden="true"
                  onError={() => setFailedMotionLook(selectedLook.id)}
                  className="absolute inset-0 h-full w-full object-cover object-[center_18%]"
                />
              )}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/70 via-transparent to-slate-950/85"
              />
              <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3 text-white">
                <div className="rounded-xl border border-white/20 bg-slate-950/65 px-3 py-2 backdrop-blur">
                  <p className="font-semibold" data-no-translate>
                    AYRA&apos;S WORLD
                  </p>
                  <p className="text-xs text-white/75">{t("ceo.ayra_command_world_intro")}</p>
                </div>
                <Badge className="border-white/20 bg-slate-950/65 text-white hover:bg-slate-950/65">
                  <Activity className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {commandMutation.isPending
                    ? t("ceo.ayra_command_thinking")
                    : t("ceo.ayra_command_standing_by")}
                </Badge>
              </div>
              <div className="absolute left-4 top-24 max-w-[min(70%,24rem)] rounded-2xl border border-primary/60 bg-slate-950/75 p-4 text-sm text-white shadow-xl backdrop-blur">
                {reply || <>{t("ceo.ayra_command_greeting")}</>}
              </div>
              {gesture && motionEnabled && (
                <div className="absolute bottom-20 right-4 h-48 w-32 overflow-hidden rounded-xl border border-white/35 bg-white shadow-xl sm:h-56 sm:w-40">
                  <video
                    key={gesture}
                    src={AYRA_GESTURES[gesture].video}
                    poster={AYRA_LOOKS.find((look) => look.id === "cyanJacket")?.portrait}
                    muted
                    playsInline
                    autoPlay
                    loop={gesture === "idle"}
                    preload="metadata"
                    aria-label={`AYRA ${AYRA_GESTURES[gesture].label} animation`}
                    onEnded={() => setGesture(null)}
                    onError={() => {
                      setGesture(null);
                      setGestureUnavailable(true);
                    }}
                    className="h-full w-full object-contain object-bottom"
                  />
                </div>
              )}
              <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/15 bg-slate-950/75 p-2 text-white backdrop-blur">
                <span className="px-2 text-xs font-medium">{selectedLook.name}</span>
                <div className="flex flex-wrap gap-1.5">
                  {GESTURES.map((gestureId) => (
                    <Button
                      key={gestureId}
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={!motionEnabled}
                      onClick={() => selectGesture(gestureId)}
                      aria-label={`AYRA ${AYRA_GESTURES[gestureId].label}`}
                      className="h-8"
                    >
                      {AYRA_GESTURES[gestureId].label}
                    </Button>
                  ))}
                  {gestureUnavailable && (
                    <span role="status" className="self-center px-2 text-xs text-amber-200">
                      {t("ceo.ayra_command_video_unavailable")}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div
              className="flex gap-2 overflow-x-auto pb-1"
              aria-label={t("ceo.ayra_command_lookbook")}
            >
              {AYRA_LOOKS.map((look) => (
                <button
                  key={look.id}
                  type="button"
                  aria-label={look.name}
                  aria-pressed={look.id === lookId}
                  onClick={() => {
                    setGesture(null);
                    setLookId(look.id);
                  }}
                  className={`w-16 shrink-0 rounded-xl border p-1 transition-colors ${
                    look.id === lookId
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/60"
                  }`}
                >
                  <img
                    src={look.portrait}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    className="aspect-[3/4] w-full rounded-lg object-cover object-top"
                  />
                  <span className="mt-1 block truncate text-[10px] text-foreground">
                    {look.name}
                  </span>
                </button>
              ))}
            </div>
            {!motionEnabled && (
              <p className="text-xs text-muted-foreground">{t("ceo.ayra_command_motion_paused")}</p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-primary/25">
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Globe className="h-5 w-5 text-primary" aria-hidden="true" />
              {t("ceo.ayra_command_browser")}
            </CardTitle>
            <div className="flex gap-1">
              {(
                [
                  ["browser", t("ceo.ayra_command_browser_tab")],
                  ["screenshot", t("ceo.ayra_command_screenshot_tab")],
                  ["download", t("ceo.ayra_command_download_tab")],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={tab === key ? "default" : "ghost"}
                  aria-pressed={tab === key}
                  onClick={() => setTab(key)}
                  className="px-2 sm:px-3"
                >
                  {label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="min-h-[30rem] overflow-hidden rounded-xl border border-border bg-background sm:min-h-[34rem]">
              <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-3 py-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 font-bold text-primary">
                  G
                </span>
                <span className="text-sm font-medium text-foreground" data-no-translate>
                  Google
                </span>
                <div className="ml-2 flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                  <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate" data-no-translate>
                    https://www.google.com
                  </span>
                  <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("ceo.ayra_command_open_google")}
                  onClick={() => openExternal("https://www.google.com")}
                >
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>

              {tab === "browser" ? (
                <div className="flex min-h-[26rem] flex-col items-center px-4 py-8 sm:px-7">
                  <div
                    className="mb-7 text-5xl font-medium tracking-tight sm:mt-4 sm:text-7xl"
                    aria-label="Google"
                    data-no-translate
                  >
                    <span className="text-[#4285f4]">G</span>
                    <span className="text-[#ea4335]">o</span>
                    <span className="text-[#fbbc05]">o</span>
                    <span className="text-[#4285f4]">g</span>
                    <span className="text-[#34a853]">l</span>
                    <span className="text-[#ea4335]">e</span>
                  </div>
                  <form
                    onSubmit={(event) => submitSearch(event)}
                    className="flex w-full max-w-xl items-center gap-2 rounded-full border border-border px-4 py-2 shadow-sm"
                  >
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <Input
                      value={searchText}
                      onChange={(event) => setSearchText(event.target.value)}
                      aria-label={t("ceo.ayra_command_search_google")}
                      className="border-0 shadow-none focus-visible:ring-0"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      variant="ghost"
                      aria-label={t("ceo.ayra_command_search_google")}
                    >
                      <Search className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </form>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button type="button" variant="secondary" onClick={() => searchGoogle()}>
                      {t("ceo.ayra_command_google_search")}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => searchGoogle(true)}>
                      {t("ceo.ayra_command_feeling_lucky")}
                    </Button>
                  </div>
                  <div className="mt-8 grid w-full grid-cols-3 gap-3 sm:grid-cols-6">
                    {GOOGLE_SHORTCUTS.map((shortcut) => (
                      <button
                        key={shortcut.label}
                        type="button"
                        onClick={() => openExternal(shortcut.url)}
                        className="group flex min-w-0 flex-col items-center gap-2 rounded-xl p-2 text-xs text-muted-foreground hover:bg-muted"
                      >
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-muted text-lg font-semibold text-primary group-hover:bg-primary/10">
                          {shortcut.mark}
                        </span>
                        <span className="truncate">{shortcut.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-auto pt-6 text-center text-xs text-muted-foreground">
                    {t("ceo.ayra_command_search_opens")}
                  </p>
                </div>
              ) : tab === "screenshot" ? (
                <div className="grid min-h-[26rem] place-items-center p-6 text-center">
                  <div className="max-w-sm">
                    <Globe className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
                    <h3 className="mt-3 font-semibold text-foreground">
                      {t("ceo.ayra_command_screenshot_unavailable")}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("ceo.ayra_command_screenshot_description")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[26rem] flex-col items-start gap-3 p-6">
                  <Download className="h-8 w-8 text-primary" aria-hidden="true" />
                  <h3 className="font-semibold text-foreground">
                    {t("ceo.ayra_command_save_answer_heading")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("ceo.ayra_command_save_answer_description")}
                  </p>
                  <Button type="button" disabled={!reply} onClick={() => downloadAnswer(reply)}>
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {t("ceo.ayra_command_download_answer")}
                  </Button>
                  {!reply && (
                    <p className="text-xs text-muted-foreground">
                      {t("ceo.ayra_command_answer_empty")}
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("ceo.ayra_command_dialog_title")}</DialogTitle>
            <DialogDescription>{t("ceo.ayra_command_dialog_description")}</DialogDescription>
          </DialogHeader>
          {settingsQuery.isPending ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t("ceo.ayra_command_loading_settings")}
            </p>
          ) : settingsQuery.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {settingsQuery.error instanceof Error
                ? settingsQuery.error.message
                : t("ceo.ayra_command_settings_failed")}
            </p>
          ) : (
            <div className="grid gap-6">
              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="ayra-motion">{t("ceo.ayra_command_scene_motion")}</Label>
                  <Switch
                    id="ayra-motion"
                    checked={settings.motionEnabled}
                    disabled={saveMutation.isPending}
                    onCheckedChange={(checked) => updateSettings({ motionEnabled: checked })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("ceo.ayra_command_scene_motion_description")}
                </p>
              </div>
              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="ayra-reactions">{t("ceo.ayra_command_live_reactions")}</Label>
                  <Switch
                    id="ayra-reactions"
                    checked={settings.liveReactions}
                    disabled={saveMutation.isPending}
                    onCheckedChange={(checked) => updateSettings({ liveReactions: checked })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("ceo.ayra_command_live_reactions_description")}
                </p>
              </div>
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ayra-brightness">{t("ceo.ayra_command_world_brightness")}</Label>
                  <span className="text-sm tabular-nums text-muted-foreground">{brightness}%</span>
                </div>
                <Slider
                  id="ayra-brightness"
                  aria-label={t("ceo.ayra_command_world_brightness")}
                  min={0}
                  max={100}
                  step={1}
                  value={[brightness]}
                  disabled={saveMutation.isPending}
                  onValueChange={([value]) => setLocalBrightness(value ?? 100)}
                  onValueCommit={([value]) => {
                    const next = value ?? 100;
                    setLocalBrightness(null);
                    updateSettings({ brightness: next });
                  }}
                />
              </div>
              {saveMutation.isPending && (
                <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {t("ceo.ayra_command_saving_settings")}
                </p>
              )}
              {saveMutation.isSuccess && (
                <p role="status" className="flex items-center gap-2 text-sm text-emerald-600">
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {t("ceo.ayra_command_settings_saved")}
                </p>
              )}
              {saveMutation.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {saveMutation.error instanceof Error
                    ? saveMutation.error.message
                    : t("ceo.ayra_command_settings_save_failed")}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => window.location.assign("/control-panel")}
              >
                {t("ceo.ayra_command_open_control_panel")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
