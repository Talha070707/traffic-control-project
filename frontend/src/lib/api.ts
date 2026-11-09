export const API_BASE = "http://localhost:5000/api";

export type SimulationRoad = {
  id: number;
  name: string;
  vehicleCount: number;
  waitTime: number;
};

export type SessionPayload = {
  algorithm: string;
  duration: number;
  totalCleared: number;
  avgWaitTime: number;
  efficiency: number;
  fcfsAvgWait: number;
  rrAvgWait: number;
  winner: string;
  perRoad: object[];
  ganttData: object[];
};

export type ScheduleStep = {
  roadIndex?: number;
  index?: number;
  roadId?: number;
  id?: number;
  roadName?: string;
  name?: string;
  greenTime?: number;
  duration?: number;
  quantum?: number;
};

export type SimulationResult = {
  fcfs: ScheduleStep[] | { schedule?: ScheduleStep[] };
  roundRobin: ScheduleStep[] | { schedule?: ScheduleStep[] };
  fcfsAvgWait: number;
  rrAvgWait: number;
  winner: string;
};

async function readJson(res: Response) {
  const data: unknown = await res.json();
  if (!res.ok) throw new Error(`Traffic API request failed (${res.status})`);
  return data;
}

export async function runSimulation(roads: SimulationRoad[], baseQuantum = 10): Promise<SimulationResult> {
  const res = await fetch(`${API_BASE}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roads, baseQuantum }),
  });
  return readJson(res) as Promise<SimulationResult>;
}

export async function saveSession(sessionData: SessionPayload) {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sessionData),
  });
  return readJson(res);
}

export async function getSessions() {
  const res = await fetch(`${API_BASE}/sessions`);
  return readJson(res);
}

export async function clearSessions() {
  const res = await fetch(`${API_BASE}/sessions`, { method: "DELETE" });
  return readJson(res);
}