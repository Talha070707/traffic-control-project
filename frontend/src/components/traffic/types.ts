export type RoadState = { id: number; name: string; color: string; vehicleCount: number; vehiclesCleared: number; isGreen: boolean; waitTime: number };
export type GanttEntry = { roadIndex: number; roadName: string; color: string; duration: number; startTime: number };
export type Session = { id: number | string; timestamp: string; duration: number; algorithm: "RR" | "FCFS"; totalCleared: number; avgWaitTime: number; efficiency: number; perRoad: { id: number; name: string; cleared: number; avgWait: number; greenTimePercent: number }[]; ganttData: GanttEntry[] };

export const ROAD_COLORS = ["var(--north)", "var(--east)", "var(--south)", "var(--west)"];
export const INITIAL_ROADS: RoadState[] = [
  { id: 0, name: "NORTH", color: ROAD_COLORS[0], vehicleCount: 18, vehiclesCleared: 142, isGreen: true, waitTime: 4 },
  { id: 1, name: "EAST", color: ROAD_COLORS[1], vehicleCount: 31, vehiclesCleared: 118, isGreen: false, waitTime: 9 },
  { id: 2, name: "SOUTH", color: ROAD_COLORS[2], vehicleCount: 11, vehiclesCleared: 156, isGreen: false, waitTime: 6 },
  { id: 3, name: "WEST", color: ROAD_COLORS[3], vehicleCount: 24, vehiclesCleared: 129, isGreen: false, waitTime: 12 },
];

export const DEMO_SESSIONS: Session[] = Array.from({ length: 6 }, (_, i) => ({
  id: 2048 - i,
  timestamp: `12 JUN 2026  ·  ${String(14 - i).padStart(2, "0")}:${String(17 + i * 3).padStart(2, "0")}`,
  duration: 320 + i * 47,
  algorithm: i % 3 === 0 ? "FCFS" : "RR",
  totalCleared: 412 - i * 23,
  avgWaitTime: 5 + i * 2.4,
  efficiency: 94 - i * 5,
  perRoad: INITIAL_ROADS.map((r, j) => ({ id: j, name: r.name, cleared: 84 + j * 17 - i * 3, avgWait: 4 + j * 1.8 + i, greenTimePercent: [28, 31, 18, 23][j] })),
  ganttData: Array.from({ length: 10 }, (__, j) => ({ roadIndex: j % 4, roadName: INITIAL_ROADS[j % 4].name, color: ROAD_COLORS[j % 4], duration: 8 + (j % 3) * 4, startTime: j * 10 })),
}));