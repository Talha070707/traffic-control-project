import { motion } from "framer-motion";
import type { RoadState } from "./types";

const CAR_COLORS = ["#1E4A6E", "#3D1E6E", "#1E6E3D", "#6E4A1E"];
const BUILDING_CORNERS = [
  [35, 35],
  [365, 35],
  [35, 365],
  [365, 365],
] as const;
const SIGNAL_CENTERS = [
  [250, 150],
  [350, 250],
  [250, 350],
  [150, 250],
] as const;

type CarLayout = {
  lanes: [number, number];
  queueAxis: "x" | "y";
  queuePositions: number[];
  moveAxis: "x" | "y";
  moveFrom: number;
  moveTo: number;
  headlight: "bottom" | "left" | "top" | "right";
};

const CAR_LAYOUTS: CarLayout[] = [
  { lanes: [210, 238], queueAxis: "y", queuePositions: [100, 78, 56, 34], moveAxis: "y", moveFrom: 100, moveTo: 260, headlight: "bottom" },
  { lanes: [212, 240], queueAxis: "x", queuePositions: [400, 422, 444, 466], moveAxis: "x", moveFrom: 400, moveTo: 240, headlight: "left" },
  { lanes: [252, 280], queueAxis: "y", queuePositions: [400, 422, 444, 466], moveAxis: "y", moveFrom: 400, moveTo: 240, headlight: "top" },
  { lanes: [210, 238], queueAxis: "x", queuePositions: [100, 78, 56, 34], moveAxis: "x", moveFrom: 100, moveTo: 260, headlight: "right" },
];

const LABEL_CONFIG = [
  { x: 250, y: 22, rotate: 0, anchor: "middle" as const },
  { x: 478, y: 255, rotate: -90, anchor: "middle" as const },
  { x: 250, y: 492, rotate: 0, anchor: "middle" as const },
  { x: 22, y: 255, rotate: 90, anchor: "middle" as const },
];

function CarShape({ color, headlight }: { color: string; headlight: CarLayout["headlight"] }) {
  const lights =
    headlight === "bottom" ? (
      <>
        <circle cx="5" cy="11" r="1.5" fill="white" />
        <circle cx="15" cy="11" r="1.5" fill="white" />
      </>
    ) : headlight === "left" ? (
      <>
        <circle cx="0" cy="4" r="1.5" fill="white" />
        <circle cx="0" cy="8" r="1.5" fill="white" />
      </>
    ) : headlight === "top" ? (
      <>
        <circle cx="5" cy="0" r="1.5" fill="white" />
        <circle cx="15" cy="0" r="1.5" fill="white" />
      </>
    ) : (
      <>
        <circle cx="20" cy="4" r="1.5" fill="white" />
        <circle cx="20" cy="8" r="1.5" fill="white" />
      </>
    );

  return (
    <>
      <rect width="20" height="11" rx="3" fill={color} />
      {lights}
    </>
  );
}

function RoadCars({ roadIndex, roads, activeRoadIndex }: { roadIndex: number; roads: RoadState[]; activeRoadIndex: number }) {
  const layout = CAR_LAYOUTS[roadIndex];
  const color = CAR_COLORS[roadIndex];
  const count = Math.min(4, Math.ceil(roads[roadIndex].vehicleCount / 4));
  const isGreen = activeRoadIndex === roadIndex;

  return (
    <>
      {layout.queuePositions.slice(0, count).map((pos, idx) => {
        const lane = layout.lanes[idx % 2];
        const x = layout.queueAxis === "x" ? pos : lane;
        const y = layout.queueAxis === "y" ? pos : lane;
        const isFront = idx === 0;

        if (isFront && isGreen) {
          const animate =
            layout.moveAxis === "y"
              ? { x, y: layout.moveTo, opacity: 0 }
              : { x: layout.moveTo, y, opacity: 0 };

          return (
            <motion.g
              key={`car-${roadIndex}-${roads[roadIndex].vehiclesCleared}`}
              initial={
                layout.moveAxis === "y"
                  ? { x, y: layout.moveFrom, opacity: 1 }
                  : { x: layout.moveFrom, y, opacity: 1 }
              }
              animate={animate}
              transition={{ duration: 1.5, ease: "easeIn" }}
            >
              <CarShape color={color} headlight={layout.headlight} />
            </motion.g>
          );
        }

        return (
          <g key={`car-${roadIndex}-${idx}`} transform={`translate(${x}, ${y})`}>
            <CarShape color={color} headlight={layout.headlight} />
          </g>
        );
      })}
    </>
  );
}

function TrafficSignal({ cx, cy, active }: { cx: number; cy: number; active: boolean }) {
  return (
    <g transform={`translate(${cx - 11}, ${cy - 27})`}>
      <rect width="22" height="54" rx="6" fill="#0A0F1A" stroke="rgba(255,255,255,0.08)" />
      <circle cx="11" cy="11" r="5" fill={active ? "#3D0A14" : "#FF3D5A"} opacity={active ? 0.35 : 1} />
      <circle cx="11" cy="27" r="5" fill={active ? "#3D2A00" : "#FFB800"} opacity={active ? 0.35 : 0.85} />
      <motion.circle
        cx="11"
        cy="43"
        r="5"
        fill={active ? "#00FF9C" : "#0A2E1A"}
        filter={active ? "url(#signalGlow)" : undefined}
        animate={{ opacity: active ? [1, 0.6, 1] : 0.4 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      />
    </g>
  );
}

function RoadLabel({
  road,
  config,
  active,
}: {
  road: RoadState;
  config: (typeof LABEL_CONFIG)[number];
  active: boolean;
}) {
  const text = `${road.name} · ${road.vehicleCount}`;
  const pillWidth = text.length * 7.5 + 24;

  return (
    <g transform={`rotate(${config.rotate}, ${config.x}, ${config.y})`}>
      {active && (
        <rect
          x={config.x - pillWidth / 2}
          y={config.y - 14}
          width={pillWidth}
          height="22"
          rx="11"
          fill={road.color}
          fillOpacity="0.15"
        />
      )}
      <text
        x={config.x}
        y={config.y}
        textAnchor={config.anchor}
        fill={road.color}
        style={{ fontFamily: "Rajdhani, sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.08em" }}
      >
        {text}
      </text>
    </g>
  );
}

export function Intersection({
  roads,
  activeRoadIndex,
  compact = false,
}: {
  roads: RoadState[];
  activeRoadIndex: number;
  compact?: boolean;
}) {
  const active = roads[activeRoadIndex];

  return (
    <svg
      viewBox="0 0 500 500"
      width="500"
      height="500"
      className={compact ? "h-full w-full" : "h-auto w-full max-w-[min(500px,100%)]"}
      role="img"
      aria-label={`Live intersection, ${active.name} road has green signal`}
    >
      <defs>
        <radialGradient id="centerGlow">
          <stop stopColor="#00D4FF" stopOpacity="0.3" />
          <stop offset="1" stopColor="#00D4FF" stopOpacity="0" />
        </radialGradient>
        <filter id="signalGlow">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="500" height="500" rx="12" fill="#0A0F1A" />

      {BUILDING_CORNERS.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="100" height="100" rx="4" fill="#0C1428" />
          {[0, 1, 2].map((row) =>
            [0, 1, 2].map((col) => (
              <circle
                key={`${row}-${col}`}
                cx={x + 22 + col * 28}
                cy={y + 22 + row * 28}
                r="3"
                fill="#00D4FF"
                opacity={(row + col) % 2 ? 0.2 : 0.6}
              />
            )),
          )}
        </g>
      ))}

      <rect x="185" y="0" width="130" height="500" fill="#141926" />
      <rect x="0" y="185" width="500" height="130" fill="#141926" />
      <rect x="185" y="185" width="130" height="130" fill="#1A2535" />

      <line x1="250" y1="0" x2="250" y2="184" stroke="rgba(255,255,255,0.12)" strokeWidth="2" strokeDasharray="14 14" className="lane-flow" />
      <line x1="250" y1="316" x2="250" y2="500" stroke="rgba(255,255,255,0.12)" strokeWidth="2" strokeDasharray="14 14" className="lane-flow" />
      <line x1="0" y1="250" x2="184" y2="250" stroke="rgba(255,255,255,0.12)" strokeWidth="2" strokeDasharray="14 14" className="lane-flow" />
      <line x1="316" y1="250" x2="500" y2="250" stroke="rgba(255,255,255,0.12)" strokeWidth="2" strokeDasharray="14 14" className="lane-flow" />

      <circle cx="250" cy="250" r="65" fill="url(#centerGlow)" />

      {SIGNAL_CENTERS.map(([cx, cy], i) => (
        <TrafficSignal key={i} cx={cx} cy={cy} active={activeRoadIndex === i} />
      ))}

      {[0, 1, 2, 3].map((i) => (
        <RoadCars key={i} roadIndex={i} roads={roads} activeRoadIndex={activeRoadIndex} />
      ))}

      {roads.map((road, i) => (
        <RoadLabel key={road.id} road={road} config={LABEL_CONFIG[i]} active={activeRoadIndex === i} />
      ))}
    </svg>
  );
}
