import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  Clock,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Trophy,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/traffic/Shell";
import { Intersection } from "@/components/traffic/Intersection";
import { INITIAL_ROADS, type GanttEntry, type RoadState } from "@/components/traffic/types";
import { runSimulation, saveSession, type ScheduleStep, type SimulationResult } from "@/lib/api";

export const Route = createFileRoute("/simulation")({
  head: () => ({
    meta: [
      { title: "Live Simulation — STC" },
      { name: "description", content: "Side-by-side FCFS vs Round Robin smart traffic scheduling comparison." },
      { property: "og:title", content: "Live Simulation — STC" },
      { property: "og:description", content: "Compare FCFS and Round Robin scheduling on a live smart intersection." },
    ],
  }),
  component: SimulationPage,
});

// ─── panel state ────────────────────────────────────────────────────────
type PanelKind = "FCFS" | "RR";
type PanelState = {
  queues: number[];          // per-road vehicles waiting
  cleared: number[];         // per-road vehicles processed
  schedule: ScheduleStep[];
  idx: number;               // current schedule step
  elapsed: number;           // seconds spent on current step
  active: number;            // current active road index
  time: number;              // total runtime seconds
  waitSum: number;           // accumulator: each tick adds remaining queue
  totalCleared: number;
  gantt: GanttEntry[];
  apiAvg: number;            // avg-wait reported by backend
};

const emptyPanel = (queues: number[]): PanelState => ({
  queues: [...queues],
  cleared: [0, 0, 0, 0],
  schedule: [],
  idx: 0,
  elapsed: 0,
  active: 0,
  time: 0,
  waitSum: 0,
  totalCleared: 0,
  gantt: [],
  apiAvg: 0,
});

function SimulationPage() {
  // shared / mirrored input
  const [baseQueues, setBaseQueues] = useState<number[]>(INITIAL_ROADS.map((r) => r.vehicleCount));
  const [quantum, setQuantum] = useState(12);
  const [running, setRunning] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [toast, setToast] = useState(false);

  // independent per-algorithm panels
  const [fcfs, setFcfs] = useState<PanelState>(() => emptyPanel(INITIAL_ROADS.map((r) => r.vehicleCount)));
  const [rr, setRr] = useState<PanelState>(() => emptyPanel(INITIAL_ROADS.map((r) => r.vehicleCount)));

  // ─── clock ────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ─── tick: advance both panels every second when running ──────────────
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setFcfs((p) => tickPanel(p, quantum));
      setRr((p) => tickPanel(p, quantum));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, quantum]);

  // ─── handlers ─────────────────────────────────────────────────────────
  const buildRoads = (queues: number[]): RoadState[] =>
    INITIAL_ROADS.map((r, i) => ({ ...r, vehicleCount: queues[i] }));

  const applyResult = (result: SimulationResult) => {
    const fSched = extractSchedule(result.fcfs);
    const rSched = extractSchedule(result.roundRobin);
    setFcfs((p) => ({ ...p, schedule: fSched, idx: 0, elapsed: 0, active: getRoadIndex(fSched[0], INITIAL_ROADS) || 0, apiAvg: result.fcfsAvgWait }));
    setRr((p) => ({ ...p, schedule: rSched, idx: 0, elapsed: 0, active: getRoadIndex(rSched[0], INITIAL_ROADS) || 0, apiAvg: result.rrAvgWait }));
  };

  const onInitialize = async () => {
    if (running) { setRunning(false); return; }
    try {
      // reset cleared/wait but keep mirrored queues
      setFcfs(emptyPanel(baseQueues));
      setRr(emptyPanel(baseQueues));
      const result = await runSimulation(buildRoads(baseQueues), quantum);
      applyResult(result);
      setRunning(true);
    } catch (error) { console.error("Unable to initialize simulation", error); }
  };

  const onInject = async () => {
    const roadIndex = Math.floor(Math.random() * 4);
    const amount = 3 + Math.floor(Math.random() * 6);
    const next = baseQueues.map((v, i) => (i === roadIndex ? v + amount : v));
    setBaseQueues(next);
    // mirror into both panels
    setFcfs((p) => ({ ...p, queues: p.queues.map((v, i) => (i === roadIndex ? v + amount : v)) }));
    setRr((p) => ({ ...p, queues: p.queues.map((v, i) => (i === roadIndex ? v + amount : v)) }));
    try { applyResult(await runSimulation(buildRoads(next), quantum)); }
    catch (error) { console.error("Unable to refresh schedules", error); }
  };

  const onReset = () => {
    setRunning(false);
    const zero = [0, 0, 0, 0];
    setBaseQueues(zero);
    setFcfs(emptyPanel(zero));
    setRr(emptyPanel(zero));
  };

  const onSessionSave = async (which: PanelKind) => {
    const p = which === "RR" ? rr : fcfs;
    const avg = panelAvgWait(p);
    try {
      await saveSession({
        algorithm: which,
        duration: p.time,
        totalCleared: p.totalCleared,
        avgWaitTime: avg,
        efficiency: Math.max(0, Math.round(100 - avg * 3)),
        fcfsAvgWait: panelAvgWait(fcfs),
        rrAvgWait: panelAvgWait(rr),
        winner: compareWinner(fcfs, rr),
        perRoad: INITIAL_ROADS.map((r, i) => ({
          id: r.id, name: r.name, cleared: p.cleared[i], avgWait: avg,
          greenTimePercent: p.gantt.length ? Math.round(p.gantt.filter((g) => g.roadIndex === i).length / p.gantt.length * 100) : 0,
        })),
        ganttData: p.gantt,
      });
      setToast(true);
      window.setTimeout(() => setToast(false), 3000);
    } catch (error) { console.error("Unable to save session", error); }
  };

  // ─── derived ──────────────────────────────────────────────────────────
  const elapsed = useMemo(() => new Date(Math.max(fcfs.time, rr.time) * 1000).toISOString().slice(11, 19), [fcfs.time, rr.time]);
  const fcfsAvg = panelAvgWait(fcfs);
  const rrAvg = panelAvgWait(rr);
  const winner = compareWinner(fcfs, rr);

  return (
    <div className="min-h-screen pb-16" style={{ paddingTop: 72 }}>
      <Navbar />

      {/* ── HEADER ─────────────────────────────────────── */}
      <header className="sim-header">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`sim-pulse ${running ? "live" : ""}`} />
          <div className="min-w-0">
            <p className="sim-crumb">SYSTEM · KARACHI · INTERSECTION-01 · DUAL ALGORITHM MODE</p>
            <h1 className="sim-title">VERSUS <span>ARENA</span></h1>
          </div>
        </div>
        <div className="sim-clock">
          <div><small>LOCAL</small><b>{clock.toLocaleTimeString("en-GB")}</b></div>
          <div><small>RUNTIME</small><b className="text-[var(--primary)]">{elapsed}</b></div>
          <div><small>STATUS</small><b className={running ? "text-[var(--success)]" : "text-[var(--muted-foreground)]"}>{running ? "● ACTIVE" : "○ STANDBY"}</b></div>
        </div>
      </header>

      {/* ── SHARED CONTROLS ────────────────────────────── */}
      <div className="sim-actionbar">
        <div className="sim-shared-label">
          <small>SHARED INPUT</small>
          <b>BOTH ALGORITHMS RUN ON SAME TICK · SAME VEHICLES</b>
        </div>
        <div className="sim-controls">
          <Button variant={running ? "warning" : "success"} onClick={onInitialize} className="gap-2">
            {running ? <><Pause className="size-4" /> SUSPEND</> : <><Play className="size-4" /> INITIALIZE BOTH</>}
          </Button>
          <Button variant="neonOutline" onClick={onInject} className="gap-2"><Plus className="size-4" /> INJECT VEHICLES</Button>
          <Button variant="dangerOutline" onClick={onReset} className="gap-2"><RotateCcw className="size-4" /> PURGE</Button>
          <label className="sim-quantum-input" title="Only applies to Round Robin">
            <span>RR QUANTUM</span>
            <input type="range" min="5" max="30" value={quantum} onChange={(e) => setQuantum(Number(e.target.value))} />
            <b>{quantum}s</b>
          </label>
        </div>
      </div>

      {/* ── COMPARISON BAR ─────────────────────────────── */}
      <section className="sim-versus-bar">
        <VersusCell
          tone="fcfs"
          label="FCFS · AVG WAIT"
          value={fcfsAvg}
          extra={[
            { k: "CYCLES", v: cycleCount(fcfs) },
            { k: "THROUGHPUT/min", v: throughputOf(fcfs) },
            { k: "CLEARED", v: fcfs.totalCleared },
          ]}
          winning={winner === "FCFS"}
        />
        <div className="sim-versus-mid">
          <span className="sim-versus-vs">VS</span>
          <AnimatePresence mode="wait">
            <motion.div
              key={winner || "tie"}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className={`sim-versus-winner ${winner ? `is-${winner.toLowerCase()}` : ""}`}
            >
              <Trophy className="size-3.5" />
              {winner ? `${winner} LEADS` : "AWAITING DATA"}
            </motion.div>
          </AnimatePresence>
        </div>
        <VersusCell
          tone="rr"
          label="ROUND ROBIN · AVG WAIT"
          value={rrAvg}
          extra={[
            { k: "CYCLES", v: cycleCount(rr) },
            { k: "THROUGHPUT/min", v: throughputOf(rr) },
            { k: "CLEARED", v: rr.totalCleared },
          ]}
          winning={winner === "RR"}
          reverse
        />
      </section>

      {/* ── DUAL PANELS ────────────────────────────────── */}
      <main className="sim-duel-grid">
        <AlgoPanel kind="FCFS" panel={fcfs} running={running} quantum={quantum} winning={winner === "FCFS"} onSave={() => onSessionSave("FCFS")} />
        <AlgoPanel kind="RR" panel={rr} running={running} quantum={quantum} winning={winner === "RR"} onSave={() => onSessionSave("RR")} />
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div className="toast" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}>
            <CheckCircle2 /> SESSION ARCHIVED SUCCESSFULLY
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── algorithm panel ───────────────────────────────────────────────────
function AlgoPanel({ kind, panel, running, quantum, winning, onSave }: {
  kind: PanelKind;
  panel: PanelState;
  running: boolean;
  quantum: number;
  winning: boolean;
  onSave: () => void;
}) {
  const roads = INITIAL_ROADS.map((r, i) => ({
    ...r,
    vehicleCount: panel.queues[i],
    vehiclesCleared: panel.cleared[i],
    isGreen: i === panel.active,
  }));
  const step = panel.schedule[panel.idx % Math.max(1, panel.schedule.length)];
  const stepDuration = getStepDuration(step, kind === "RR" ? quantum : 8);
  const remaining = Math.max(0, stepDuration - panel.elapsed);
  const progress = stepDuration ? (panel.elapsed / stepDuration) * 100 : 0;
  const avg = panelAvgWait(panel);
  const queueTotal = panel.queues.reduce((a, v) => a + v, 0);
  const active = roads[panel.active];

  return (
    <section className={`algo-panel algo-${kind.toLowerCase()} ${winning ? "is-winning" : ""}`}>
      <header className="algo-panel-head">
        <div>
          <small>ALGORITHM</small>
          <h2>{kind === "FCFS" ? "FIRST COME FIRST SERVE" : "ROUND ROBIN"}</h2>
        </div>
        <div className={`algo-status ${running ? "live" : ""}`}>
          <span className="algo-dot" />
          {running ? "RUNNING" : "IDLE"}
          {winning && <Trophy className="size-3 ml-2" />}
        </div>
      </header>

      <div className="algo-now">
        <div>
          <small>NOW SERVING</small>
          <strong style={{ color: active.color }}>{active.name}</strong>
        </div>
        <div className="algo-progress">
          <div className="algo-progress-bar"><i style={{ width: `${progress}%` }} /></div>
          <span><Clock className="size-3 inline" /> {remaining}s / {stepDuration}s</span>
        </div>
      </div>

      <div className="algo-stage">
        <Intersection roads={roads} activeRoadIndex={panel.active} compact />
      </div>

      <div className="algo-roads">
        {roads.map((r, i) => (
          <motion.div
            key={r.id}
            className={`algo-road ${i === panel.active ? "is-active" : ""}`}
            style={{ "--road": r.color } as React.CSSProperties}
            animate={{ scale: i === panel.active ? 1.02 : 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
          >
            <span className="algo-road-name">{r.name}</span>
            <div className="algo-road-stats">
              <div><strong>{r.vehicleCount}</strong><small>QUEUE</small></div>
              <div><strong className="text-[var(--success)]">{r.vehiclesCleared}</strong><small>CLEARED</small></div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="algo-metrics">
        <Metric label="AVG WAIT" value={`${avg.toFixed(1)}s`} highlight />
        <Metric label="QUEUED" value={queueTotal} />
        <Metric label="CLEARED" value={panel.totalCleared} />
        <Metric label="RUNTIME" value={`${panel.time}s`} />
      </div>

      <Button variant="neonOutline" className="w-full gap-2 algo-save" onClick={onSave}>
        <Save className="size-3.5" /> SAVE {kind} SESSION
      </Button>
    </section>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <motion.div className={`algo-metric ${highlight ? "is-highlight" : ""}`} key={String(value)} initial={{ y: 4, opacity: 0.6 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.25 }}>
      <strong>{value}</strong>
      <small>{label}</small>
    </motion.div>
  );
}

function VersusCell({ tone, label, value, extra, winning, reverse }: {
  tone: "fcfs" | "rr"; label: string; value: number;
  extra: { k: string; v: string | number }[]; winning: boolean; reverse?: boolean;
}) {
  return (
    <div className={`sim-versus-cell tone-${tone} ${winning ? "wins" : ""} ${reverse ? "rev" : ""}`}>
      <div className="sim-versus-main">
        <small>{label}</small>
        <motion.b key={value.toFixed(1)} initial={{ scale: 0.9, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }}>
          {value.toFixed(2)}<span>s</span>
        </motion.b>
      </div>
      <div className="sim-versus-extra">
        {extra.map((e) => (
          <div key={e.k}><b>{e.v}</b><small>{e.k}</small></div>
        ))}
      </div>
    </div>
  );
}

// ─── tick logic ────────────────────────────────────────────────────────
function tickPanel(p: PanelState, quantum: number): PanelState {
  if (!p.schedule.length) return p;
  const step = p.schedule[p.idx % p.schedule.length];
  const stepDuration = getStepDuration(step, quantum);
  const active = getRoadIndex(step, INITIAL_ROADS);
  const safeActive = active >= 0 ? active : p.active;

  const queues = [...p.queues];
  const cleared = [...p.cleared];
  let totalCleared = p.totalCleared;
  let didClear = false;
  if (queues[safeActive] > 0) {
    queues[safeActive] -= 1;
    cleared[safeActive] += 1;
    totalCleared += 1;
    didClear = true;
  }
  // accumulate wait: every queued vehicle (other than the served one) waited 1s
  const waitTick = queues.reduce((a, v) => a + v, 0) + (didClear ? 0 : 0);

  let elapsed = p.elapsed + 1;
  let idx = p.idx;
  let gantt = p.gantt;
  if (elapsed >= stepDuration) {
    gantt = [
      ...p.gantt,
      {
        roadIndex: safeActive,
        roadName: INITIAL_ROADS[safeActive].name,
        color: INITIAL_ROADS[safeActive].color,
        duration: stepDuration,
        startTime: Math.max(0, p.time + 1 - stepDuration),
      },
    ];
    elapsed = 0;
    idx = (p.idx + 1) % p.schedule.length;
  }
  const nextActive = getRoadIndex(p.schedule[idx % p.schedule.length], INITIAL_ROADS);
  return {
    ...p,
    queues,
    cleared,
    totalCleared,
    waitSum: p.waitSum + waitTick,
    time: p.time + 1,
    elapsed,
    idx,
    gantt,
    active: nextActive >= 0 ? nextActive : safeActive,
  };
}

function panelAvgWait(p: PanelState) {
  if (p.totalCleared === 0) return p.apiAvg || 0;
  return p.waitSum / p.totalCleared;
}
function cycleCount(p: PanelState) { return p.schedule.length ? Math.floor(p.gantt.length / p.schedule.length) : 0; }
function throughputOf(p: PanelState) { return p.time ? Math.round((p.totalCleared / p.time) * 60) : 0; }
function compareWinner(f: PanelState, r: PanelState): string {
  const fa = panelAvgWait(f), ra = panelAvgWait(r);
  if (!fa && !ra) return "";
  if (fa === ra) return "";
  return fa < ra ? "FCFS" : "RR";
}

// ─── helpers (unchanged contract) ──────────────────────────────────────
function extractSchedule(value: SimulationResult["fcfs"]) {
  return Array.isArray(value) ? value : value.schedule ?? [];
}
function getRoadIndex(step: ScheduleStep | undefined, roads: RoadState[]) {
  if (!step) return -1;
  const candidate = step.roadIndex ?? step.index ?? step.roadId ?? step.id;
  if (typeof candidate === "number") {
    const byId = roads.findIndex((r) => r.id === candidate);
    if (byId >= 0) return byId;
    if (candidate >= 0 && candidate < roads.length) return candidate;
  }
  const name = step.roadName ?? step.name;
  return name ? roads.findIndex((r) => r.name.toLowerCase() === name.toLowerCase()) : -1;
}
function getStepDuration(step: ScheduleStep | undefined, fallback: number) {
  return Math.max(1, Number(step?.greenTime ?? step?.duration ?? step?.quantum ?? fallback));
}
// silence unused import warning by re-exposing
export const _icons = { Activity, Zap };
