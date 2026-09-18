import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Fingerprint, Globe, LockKeyhole, Mail, Mic, MicOff, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { OwlStage, type OwlState } from "@/components/owl/OwlStage";
import type { MessageKey } from "@/lib/i18n/messages";
import { richText, useTranslation } from "@/lib/i18n/use-translation";
import { LanguageSelector } from "@/components/i18n/LanguageSelector";
import { supabase } from "@/integrations/supabase/client";


const ROLE_DESTINATIONS: Record<string, string> = {
  admin: "/control-panel",
  boss: "/boss",
  reseller: "/dashboard/reseller",
  finance: "/manager/finance",
  franchise: "/franchise-manager",
  employee: "/manager/people",
  sales: "/sales-support-manager?section=sales",
  support: "/support",
  marketing: "/marketing",
  developer: "/manager/product-api",
  customer: "/support?section=customer-operations",
  influencer: "/dashboard/influencer",
  affiliate: "/dashboard/affiliate",
  author: "/dashboard/author",
  vendor: "/dashboard/vendor",
  seo: "/dashboard/seo",
};

type Props = { redirectTo?: string };

export function CanonicalLogin({ redirectTo }: Props) {
  const navigate = useNavigate();
  const { language, dir, t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState(false);
  const [owlState, setOwlState] = useState<OwlState>("idle");
  // A key, so the line follows the language; sign-in errors come as text.
  const [assistant, setAssistant] = useState<MessageKey | { raw: string }>("auth.assistant.idle");
  const assistantLine = typeof assistant === "string" ? t(assistant) : assistant.raw;


  useEffect(() => {
    if (!voice || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(assistantLine);
    utterance.lang = language.locale;
    window.speechSynthesis.speak(utterance);
    return () => window.speechSynthesis.cancel();
  }, [assistantLine, language.locale, voice]);

  const routeAfterAuth = async () => {
    if (redirectTo?.startsWith("/")) {
      window.location.assign(redirectTo);
      return;
    }
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      navigate({ to: "/", replace: true });
      return;
    }
    const { error: claimError } = await supabase.rpc("claim_influencer_profile");
    if (claimError) {
      toast.error(claimError.message);
      navigate({ to: "/", replace: true });
      return;
    }
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).order("role", { ascending: true });
    const destination = ROLE_DESTINATIONS[String(roleRows?.[0]?.role ?? "").toLowerCase()];
    if (destination) window.location.assign(destination);
    else navigate({ to: "/", replace: true });
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setOwlState("curious");
      setAssistant("auth.assistant.missing_credentials");
      toast.error(t("auth.error.missing_credentials"));
      return;
    }
    setBusy(true);
    setOwlState("hide");
    setAssistant("auth.assistant.checking");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
      if (error) {
        setOwlState("curious");
        setAssistant({ raw: error.message });
        toast.error(error.message);
        return;
      }
      setOwlState("celebrate");
      setAssistant("auth.assistant.authenticated");
      toast.success(t("auth.signed_in"));
      window.setTimeout(() => void routeAfterAuth(), 400);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("auth.error.sign_in_failed");
      setOwlState("curious");
      setAssistant("auth.assistant.check_failed");
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const signInWithProvider = async (provider: "google" | "apple" | "azure") => {
    setBusy(true);
    setOwlState("hide");
    // Carry the destination across the provider round trip, or the visitor
    // comes back signed in and lands somewhere they never asked for.
    const back = redirectTo?.startsWith("/") && !redirectTo.startsWith("//")
      ? `${window.location.origin}/login?redirect=${encodeURIComponent(redirectTo)}`
      : `${window.location.origin}/login`;
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: back } });
    if (error) {
      setBusy(false);
      setOwlState("curious");
      toast.error(error.message);
    }
  };

  const resetPassword = async () => {
    const value = email.trim() || window.prompt(t("auth.reset.prompt"), "")?.trim();
    if (!value) return;
    const { error } = await supabase.auth.resetPasswordForEmail(value, { redirectTo: `${window.location.origin}/login` });
    if (error) toast.error(error.message);
    else toast.success(t("auth.reset.sent"));
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col overflow-x-hidden bg-[oklch(0.10_0.02_265)] text-[oklch(0.96_0.01_260)]" dir={dir}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[radial-gradient(80%_60%_at_18%_8%,oklch(0.36_0.16_330_/_0.55),transparent_60%),radial-gradient(70%_60%_at_92%_18%,oklch(0.34_0.14_70_/_0.42),transparent_62%),linear-gradient(180deg,oklch(0.13_0.03_320),oklch(0.09_0.02_310))]">
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(oklch(1_0_0_/_0.6)_1px,transparent_1px),linear-gradient(90deg,oklch(1_0_0_/_0.6)_1px,transparent_1px)] [background-size:56px_56px]" />
      </div>
      <header className="relative z-10 flex shrink-0 items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" translate="no" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70 hover:text-white">Software Vala · Nexus OS</Link>
        <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-emerald-200 ring-1 ring-emerald-400/25">{t("auth.workspace_live")}</span>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-3 px-4 py-3 sm:px-6 lg:min-h-0 lg:grid-cols-[290px_minmax(0,1fr)_330px] lg:gap-5 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <aside className="hidden min-h-0 lg:flex lg:flex-col lg:gap-3">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl p-5 ring-1 ring-white/10 [background:linear-gradient(160deg,oklch(0.34_0.13_268),oklch(0.20_0.08_272)_60%,oklch(0.14_0.04_268))] shadow-[0_30px_70px_-30px_black]">
            <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,white_1px,transparent_1px)] [background-size:28px_28px]" />
            <div className="relative flex h-full flex-col justify-end">
              <span className="w-fit rounded-full bg-black/35 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-sky-100 ring-1 ring-sky-300/40">{t("auth.platform")}</span>
              <h2 className="mt-3 text-xl font-semibold leading-tight text-white">{t("auth.platform.title")}</h2>
              <p className="mt-2 text-xs leading-relaxed text-white/70">{t("auth.platform.body")}</p>
            </div>
          </div>
          <div className="rounded-2xl p-3.5 ring-1 ring-white/10 [background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(0,0,0,.12))]">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">{t("auth.pulse.title")}</p>
            <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">{([["42", t("auth.pulse.regions")], ["1M+", t("auth.pulse.operators")], ["12K+", t("auth.pulse.products")]] as const).map(([value, label]) => <div key={label} className="rounded-lg bg-white/[0.03] py-2 ring-1 ring-white/10"><p className="text-[15px] font-semibold text-white">{value}</p><p className="text-[9px] uppercase tracking-wider text-white/50">{label}</p></div>)}</div>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 items-center justify-center">
          <div className="relative w-full max-w-[540px] overflow-hidden rounded-2xl p-0 ring-1 ring-white/10 shadow-[0_60px_120px_-40px_black,inset_0_1px_0_oklch(1_0_0_/_0.1)] [background:linear-gradient(180deg,oklch(1_0_0_/_0.07),oklch(1_0_0_/_0.015)_45%,oklch(0_0_0_/_0.1))]">
            <div className="relative px-6 pt-5">
              <div className="mb-3 flex items-center justify-end gap-2">
                <LanguageSelector triggerClassName="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 text-[11px] text-white/80 ring-1 ring-white/10 hover:bg-white/[0.1]" />
                <button type="button" onClick={() => setVoice((value) => !value)} aria-pressed={voice} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] text-white/75 ring-1 ring-white/10">{voice ? <Mic className="size-3" /> : <MicOff className="size-3" />}{voice ? t("auth.voice.speaking") : t("auth.voice.speak")}</button>
              </div>
              <div className="flex items-start justify-between"><div><p translate="no" className="text-[17px] font-semibold tracking-tight text-white">Software Vala</p><p className="mt-0.5 text-[9.5px] uppercase tracking-[0.22em] text-white/45">{t("auth.tagline")}</p></div><span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-200 ring-1 ring-amber-300/30">{t("auth.founder_access")}</span></div>
              <div className="mt-4"><h1 className="text-[clamp(20px,2.2vh+10px,26px)] font-semibold leading-tight text-white">{richText(t("auth.welcome_back"), { name: <span className="bg-gradient-to-r from-fuchsia-200 via-rose-200 to-amber-200 bg-clip-text text-transparent">{t("auth.welcome_name")}</span> })}</h1><p className="mt-1 text-[12.5px] text-white/55">{t("auth.sign_in_intro")}</p></div>
            </div>
            <form onSubmit={submit} className="mt-5 space-y-3 px-6 pb-6">
              <label className="group block rounded-xl bg-white/[0.04] px-3.5 py-2.5 ring-1 ring-white/10 focus-within:ring-fuchsia-400/60"><span className="text-[10px] uppercase tracking-[0.16em] text-white/45">{t("auth.work_email")}</span><span className="mt-0.5 flex items-center gap-2"><Mail className="size-4 text-white/55" /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} onFocus={() => { setOwlState("curious"); setAssistant("auth.assistant.identifying"); }} placeholder={t("auth.email_placeholder")} className="min-w-0 flex-1 bg-transparent text-[14px] text-white placeholder:text-white/30 outline-none" /></span></label>
              <label className="group block rounded-xl bg-white/[0.04] px-3.5 py-2.5 ring-1 ring-white/10 focus-within:ring-fuchsia-400/60"><span className="text-[10px] uppercase tracking-[0.16em] text-white/45">{t("auth.password")}</span><span className="mt-0.5 flex items-center gap-2"><LockKeyhole className="size-4 text-white/55" /><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} onFocus={() => setOwlState("hide")} placeholder={t("auth.password_placeholder")} className="min-w-0 flex-1 bg-transparent text-[14px] text-white placeholder:text-white/30 outline-none" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? t("auth.hide_password") : t("auth.show_password")} className="text-white/50 hover:text-white">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span></label>
              <div className="flex items-center justify-between text-xs text-white/65"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="accent-fuchsia-400" /> {t("auth.remember_device")}</label><button type="button" onClick={() => void resetPassword()} className="text-violet-300 hover:text-violet-200">{t("auth.forgot_password")}</button></div>
              <button type="submit" disabled={busy} className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-3.5 text-sm font-semibold text-white ring-1 ring-sky-300/40 shadow-[0_22px_50px_-16px_oklch(0.55_0.22_280_/_0.85),inset_0_1px_0_oklch(1_0_0_/_0.32),inset_0_-4px_10px_black] transition hover:-translate-y-px disabled:opacity-70 [background:linear-gradient(135deg,oklch(0.58_0.21_335),oklch(0.66_0.17_55))]">{busy ? <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <ShieldCheck className="size-4" />}{busy ? t("auth.verifying") : t("auth.secure_sign_in")}{!busy && <ArrowRight className="size-4" />}</button>
              <div className="flex items-center justify-center gap-2 text-xs text-white/45"><span>{t("auth.need_account")}</span><Link to="/apply/reseller" className="text-cyan-300 hover:text-cyan-200">{t("auth.apply_now")}</Link></div>
            </form>
            <div className="grid grid-cols-2 gap-2 px-6 pb-4 sm:grid-cols-4">{([["Google", "google"], ["Microsoft", "azure"], ["Apple", "apple"], [t("auth.provider.enterprise"), null]] as const).map(([label, provider]) => <button key={label} type="button" disabled={busy} onClick={() => provider ? void signInWithProvider(provider) : toast.info(t("auth.enterprise_sso_missing"))} className="rounded-xl bg-white/[0.06] px-2 py-2 text-xs text-white/80 ring-1 ring-white/10 hover:bg-white/[0.1] disabled:opacity-50">{label}</button>)}</div>
            <div className="grid grid-cols-3 gap-px bg-white/10 px-px pb-px">{([[ShieldCheck, t("auth.status.security"), t("auth.status.healthy")], [Fingerprint, t("auth.status.last_sign_in"), t("auth.status.this_device")], [Globe, t("auth.status.region"), t("auth.status.auto_routed")]] as const).map(([Icon, label, value]) => <div key={String(label)} className="bg-[oklch(0.14_0.02_265)] px-3.5 py-2.5"><div className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.16em] text-white/45"><Icon className="size-3" />{label}</div><p className="mt-0.5 truncate text-[11.5px] font-medium text-white/85">{value}</p></div>)}</div>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col justify-center"><div className="overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-[0_50px_110px_-38px_black] [background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(0,0,0,.2))]"><div className="relative h-[250px] overflow-hidden sm:h-[330px] lg:h-[460px]"><OwlStage state={owlState} /><div className="absolute right-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-[10px] text-white/85 ring-1 ring-white/15">{owlState === "hide" ? t("auth.concierge.privacy") : owlState === "celebrate" ? t("auth.concierge.authenticated") : t("auth.concierge")}</div></div><div className="space-y-3 p-5"><div className="flex items-center justify-between"><div><p className="text-[11px] uppercase tracking-[0.18em] text-white/55">{t("auth.concierge")}</p><p className="mt-0.5 text-[15px] font-semibold text-white"><span translate="no">Vala</span> · {owlState === "celebrate" ? t("auth.concierge.delighted") : t("auth.concierge.standing_by")}</p></div><span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" /></div><div className="rounded-2xl bg-white/[0.05] p-3 text-[13px] leading-relaxed text-white/85 ring-1 ring-white/10">{assistantLine}</div></div></div></aside>
      </main>
      <footer className="relative z-10 shrink-0 px-6 pb-2 text-center text-[10px] text-white/40">{t("auth.footer")}</footer>
    </div>
  );
}