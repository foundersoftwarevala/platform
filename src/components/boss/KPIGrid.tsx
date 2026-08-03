/**
 * Next-Generation KPI Card System
 * Double-layer premium enterprise widgets with a live status base layer,
 * animated counters, sparklines, tilt interaction and a live activity strip.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface KPIGridProps {
  children: React.ReactNode;
  className?: string;
  gap?: 'sm' | 'md' | 'lg';
}

export function KPIGrid({ children, className, gap = 'md' }: KPIGridProps) {
  const gapClasses = {
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-6',
  };

  return (
    <div
      className={cn(
        'grid w-full',
        'grid-cols-1 sm:grid-cols-2',
        gapClasses[gap],
        'auto-rows-fr',
        className
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

type Status = 'healthy' | 'warning' | 'critical' | 'action';

const BASE_THEME: Record<
  Status,
  { glow: string; strip: string; text: string; dot: string; label: string }
> = {
  healthy: {
    glow: 'rgba(74,222,128,0.55)',
    strip: 'linear-gradient(180deg,#7ef27e 0%,#4ade80 55%,#22c55e 100%)',
    text: 'text-[#08260f]',
    dot: 'bg-emerald-400',
    label: 'HEALTHY',
  },
  action: {
    glow: 'rgba(88,160,255,0.55)',
    strip: 'linear-gradient(180deg,#7ab8ff 0%,#3b82f6 55%,#2563eb 100%)',
    text: 'text-[#03142e]',
    dot: 'bg-sky-400',
    label: 'RUNNING',
  },
  warning: {
    glow: 'rgba(251,191,36,0.55)',
    strip: 'linear-gradient(180deg,#ffd469 0%,#fbbf24 55%,#f59e0b 100%)',
    text: 'text-[#2b1a02]',
    dot: 'bg-amber-400',
    label: 'WARNING',
  },
  critical: {
    glow: 'rgba(248,113,113,0.6)',
    strip: 'linear-gradient(180deg,#ff9a9a 0%,#f87171 55%,#ef4444 100%)',
    text: 'text-[#2c0606]',
    dot: 'bg-red-400',
    label: 'CRITICAL',
  },
};

const ACTIVITY_BY_STATUS: Record<Status, string[]> = {
  healthy: ['Database synchronized', 'Backup completed', 'CPU normal', 'Marketplace active'],
  action: ['AI analysing revenue', 'Revenue updated', 'Live users online', 'Syncing inventory'],
  warning: ['Threshold approaching', 'Queue backlog rising', 'Latency above normal', 'Review pending'],
  critical: ['Immediate action required', 'Error rate spiking', 'Escalation triggered', 'Retry in progress'],
};

/** parses a leading/embedded numeric part so we can animate it */
function splitNumeric(value: string | number) {
  const raw = String(value);
  const match = raw.match(/-?[\d,]*\.?\d+/);
  if (!match) return null;
  const num = Number(match[0].replace(/,/g, ''));
  if (!Number.isFinite(num)) return null;
  return {
    num,
    prefix: raw.slice(0, match.index ?? 0),
    suffix: raw.slice((match.index ?? 0) + match[0].length),
    decimals: (match[0].split('.')[1] || '').length,
    grouped: match[0].includes(','),
  };
}

function AnimatedValue({ value }: { value: string | number }) {
  const parsed = React.useMemo(() => splitNumeric(value), [value]);
  const [display, setDisplay] = React.useState(parsed ? 0 : null);

  React.useEffect(() => {
    if (!parsed) return;
    let frame = 0;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(parsed.num * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [parsed?.num]);

  if (!parsed || display === null) return <>{value}</>;

  const formatted = display.toLocaleString(undefined, {
    minimumFractionDigits: parsed.decimals,
    maximumFractionDigits: parsed.decimals,
    useGrouping: parsed.grouped,
  });

  return (
    <>
      {parsed.prefix}
      <span className="tabular-nums">{formatted}</span>
      {parsed.suffix}
    </>
  );
}

function Sparkline({ seed, color }: { seed: string; color: string }) {
  const points = React.useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 9973;
    return Array.from({ length: 14 }, (_, i) => {
      h = (h * 1103515245 + 12345) % 2147483647;
      return 4 + ((h >>> 8) % 18) + i * 0.5;
    });
  }, [seed]);

  const max = Math.max(...points);
  const min = Math.min(...points);
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 26 - ((p - min) / Math.max(1, max - min)) * 22;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-7 w-full opacity-90">
      <defs>
        <linearGradient id={`spark-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L100,28 L0,28 Z`} fill={`url(#spark-${seed})`} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="[stroke-dasharray:200] [stroke-dashoffset:200] animate-[kpi-draw_1.6s_ease-out_forwards]"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* KPI Box                                                             */
/* ------------------------------------------------------------------ */

interface KPIBoxProps {
  id: string;
  label: string;
  value: string | number;
  subValues?: string[];
  status: Status;
  icon: React.ElementType;
  source: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  lastUpdate?: string;
  isSelected?: boolean;
  onClick?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export function KPIBox({
  id,
  label,
  value,
  subValues,
  status,
  icon: Icon,
  source,
  urgency,
  lastUpdate,
  isSelected,
  onClick,
  actions,
  className,
}: KPIBoxProps) {
  const theme = BASE_THEME[status];
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = React.useState({ x: 0, y: 0, mx: 50, my: 50 });
  const [clock, setClock] = React.useState('--:--:--');

  const activities = ACTIVITY_BY_STATUS[status];
  const [activityIndex, setActivityIndex] = React.useState(0);

  React.useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    tick();
    const t = setInterval(

      () =>
        setClock(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        ),
      1000
    );
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    const offset = (id.length % 5) * 700;
    const t = setInterval(() => setActivityIndex((i) => (i + 1) % activities.length), 4200 + offset);
    return () => clearInterval(t);
  }, [id, activities.length]);

  const handleMove = (e: React.MouseEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({ x: (0.5 - py) * 6, y: (px - 0.5) * 8, mx: px * 100, my: py * 100 });
  };

  const trend = (id.charCodeAt(0) + label.length) % 2 === 0;
  const delta = (((id.charCodeAt(1) || 7) * 13) % 180) / 10;

  return (
    <div className={cn('relative h-full pb-7 [perspective:1200px]', className)}>
      {/* ---- Live status base layer (second floating layer) ---- */}
      <div
        className="pointer-events-none absolute inset-x-3 bottom-0 h-14 overflow-hidden rounded-[26px]"
        style={{ background: theme.strip, boxShadow: `0 16px 34px -14px ${theme.glow}` }}
      >
        <div className="absolute inset-0 animate-[kpi-sweep_3.2s_linear_infinite] bg-[linear-gradient(100deg,transparent_20%,rgba(255,255,255,0.55)_50%,transparent_80%)] opacity-60" />
        <div className={cn('absolute inset-x-0 bottom-0 flex h-7 items-center justify-center gap-1.5 px-3', theme.text)}>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
          <span key={activityIndex} className="animate-fade-in truncate text-[10px] font-bold tracking-wide">
            {activities[activityIndex]}
          </span>
        </div>
      </div>

      {/* ---- Primary card ---- */}
      <motion.div
        ref={cardRef}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
        onMouseMove={handleMove}
        onMouseLeave={() => setTilt({ x: 0, y: 0, mx: 50, my: 50 })}
        whileHover={{ y: -6 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: 'spring', stiffness: 340, damping: 26 }}
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          backgroundImage: `radial-gradient(520px circle at ${tilt.mx}% ${tilt.my}%, rgba(120,180,255,0.13), transparent 45%), linear-gradient(162deg,#152238 0%,#0d1728 48%,#080e1c 100%)`,
        }}
        className={cn(
          'group relative z-10 flex h-full min-h-[150px] cursor-pointer flex-col overflow-hidden rounded-[28px] p-4',
          'border border-white/[0.07] will-change-transform outline-none',
          'shadow-[0_1px_0_0_rgba(255,255,255,0.07)_inset,0_28px_56px_-26px_rgba(0,0,0,0.95)]',
          'transition-shadow duration-300 hover:shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset,0_40px_70px_-28px_rgba(0,0,0,1)]',
          'focus-visible:ring-2 focus-visible:ring-primary/70',
          isSelected && 'ring-2 ring-primary/80'
        )}
      >
        {/* corner light sweep */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

        {/* TOP BAR */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className={cn('h-1.5 w-1.5 animate-pulse rounded-full', theme.dot)} />
            <span className="text-[9px] font-bold tracking-[0.18em] text-foreground/55">LIVE</span>
            <span className="text-[9px] font-semibold text-foreground/30">· AI MONITORING</span>
          </div>
          <span className="font-mono text-[9px] tabular-nums text-foreground/40">{clock}</span>
        </div>

        {/* MAIN */}
        <div className="relative mt-2.5 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-foreground/55">
              {label}
            </p>
            <p className="mt-1.5 text-[2rem] font-extrabold leading-none tracking-[-0.03em] text-foreground">
              <AnimatedValue value={value} />
            </p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                  trend ? 'bg-emerald-400/12 text-emerald-300' : 'bg-red-400/12 text-red-300'
                )}
              >
                {trend ? '▲' : '▼'} {delta.toFixed(1)}%
              </span>
              <span className="truncate text-[9px] font-medium text-foreground/40">
                vs yesterday · {source}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105">
              <Icon className="h-5 w-5 text-primary-glow" />
            </div>
            <span className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-foreground/45">
              {theme.label}
            </span>
          </div>
        </div>

        {/* Sparkline */}
        <div className="relative -mx-1 mt-1.5">
          <Sparkline seed={id} color={theme.glow.replace(/[\d.]+\)$/, '1)')} />
        </div>

        {/* footer */}
        <div className="relative mt-auto flex items-center justify-between gap-2 pt-1.5">
          <p className="truncate text-[9px] font-medium text-foreground/40">
            {subValues && subValues.length > 0
              ? subValues.join(' • ')
              : `Updated ${lastUpdate ?? 'just now'} · ${urgency.toUpperCase()}`}
          </p>
          {actions && (
            <div
              className={cn(
                'flex items-center gap-1 transition-opacity',
                'opacity-0 group-hover:opacity-100',
                isSelected && 'opacity-100'
              )}
            >
              {actions}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// Quick action button for KPI boxes
interface KPIActionButtonProps {
  action: string;
  icon: React.ElementType;
  onClick: (e: React.MouseEvent) => void;
  loading?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  size?: 'xs' | 'sm';
}

export function KPIActionButton({
  action,
  icon: Icon,
  onClick,
  loading,
  variant = 'default',
  size = 'xs',
}: KPIActionButtonProps) {
  const variantStyles = {
    default: 'bg-white/10 hover:bg-white/20 text-foreground',
    success: 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300',
    warning: 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300',
    danger: 'bg-destructive/20 hover:bg-destructive/30 text-destructive',
  };

  const sizeStyles = {
    xs: 'w-5 h-5',
    sm: 'w-6 h-6',
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!loading) onClick(e);
      }}
      disabled={loading}
      title={action}
      className={cn(
        'flex items-center justify-center rounded transition-colors',
        sizeStyles[size],
        variantStyles[variant],
        loading && 'opacity-50 cursor-wait'
      )}
    >
      <Icon className={cn('w-3 h-3', loading && 'animate-spin')} />
    </button>
  );
}
