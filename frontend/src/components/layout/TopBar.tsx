import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Train, Loader2, Maximize2, Minimize2 } from "lucide-react";
import { checkHealth } from "../../api/health";
import { useAuth } from "../../contexts/AuthContext";
import { clsx } from "../../utils/clsx";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  SENIOR_DOM: "Sr. DOM",
  PLANNER: "Section Planner",
  DEPARTMENT_APPROVER: "Dept. Approver",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "text-red-400",
  SENIOR_DOM: "text-rail-blue",
  PLANNER: "text-emerald-400",
  DEPARTMENT_APPROVER: "text-amber-400",
};

function useISTClock() {
  const [time, setTime] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
      setDateStr(
        now.toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return { time, dateStr };
}

interface TopBarProps {
  presentationMode?: boolean;
  onTogglePresentation?: () => void;
}

export function TopBar({ presentationMode, onTogglePresentation }: TopBarProps) {
  const { time, dateStr } = useISTClock();
  const { user } = useAuth();

  const { data: health, isLoading, isError } = useQuery({
    queryKey: ["health"],
    queryFn: checkHealth,
    refetchInterval: 15_000,
    retry: 1,
  });

  const isConnected = health?.status === "ok" && !isError;

  return (
    <header className="h-10 bg-navy-800 border-b border-surface-border flex items-center justify-between px-4 shrink-0 z-30">
      {/* Left — Branding */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Train size={13} className="text-rail-blue" />
          <span className="text-[11px] font-bold text-white tracking-wide">RAILOPT</span>
          <span className="text-[11px] text-gray-600">|</span>
          <span className="hidden lg:inline text-[11px] text-gray-400">North Central Railway — Prayagraj Division</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-bold tracking-wide">
          SIH 2026
        </span>
      </div>

      {/* Right — Status + clock */}
      <div className="flex items-center gap-3">
        {/* Backend status */}
        <div className="flex items-center gap-1.5">
          {isLoading ? (
            <>
              <Loader2 size={10} className="text-gray-500 animate-spin" />
              <span className="text-[10px] text-gray-500">Connecting…</span>
            </>
          ) : isConnected ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-semibold">API LIVE</span>
            </>
          ) : (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-rail-red" />
              <span className="text-[10px] text-rail-red font-semibold">OFFLINE</span>
            </>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-4 bg-surface-border" />

        {/* User role */}
        {user && (
          <div className="hidden sm:flex items-center gap-1.5">
            <span className={clsx("text-[10px] font-bold", ROLE_COLORS[user.role] ?? "text-gray-400")}>
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </div>
        )}

        {/* IST Clock */}
        <div className="flex items-center gap-1 bg-navy-900 border border-surface-border rounded px-2 py-0.5">
          <span className="hidden md:inline text-[10px] text-gray-600">{dateStr}</span>
          {dateStr && <span className="hidden md:inline text-[10px] text-gray-700">·</span>}
          <span className="text-[10px] font-mono font-bold text-gray-200 tabular-nums">{time}</span>
          <span className="text-[9px] text-gray-600 ml-0.5">IST</span>
        </div>

        {/* Presentation mode toggle */}
        {onTogglePresentation && (
          <button
            onClick={onTogglePresentation}
            className="btn-icon w-7 h-7 text-gray-500 hover:text-gray-200"
            title={presentationMode ? "Exit Presentation Mode" : "Enter Presentation Mode"}
          >
            {presentationMode ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        )}
      </div>
    </header>
  );
}
