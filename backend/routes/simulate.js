const express = require('express');
const router = express.Router();
const fcfsScheduler = require('../algorithms/fcfs');
const roundRobinScheduler = require('../algorithms/roundRobin');

// vehicle-weighted average wait — roads with 0 vehicles excluded
const calcAvgWait = (schedule, roadMap) => {
  const activeRoads = Object.values(roadMap).filter((r) => r.vehicleCount > 0);
  if (!activeRoads.length) return 0;

  const totalWeightedWait = schedule.reduce((sum, step) => {
    const road = roadMap[step.roadId];
    if (!road || road.vehicleCount === 0) return sum;
    return sum + step.schedulingDelay * road.vehicleCount;
  }, 0);

  const totalVehicles = activeRoads.reduce((s, r) => s + r.vehicleCount, 0);
  return Math.round((totalWeightedWait / totalVehicles) * 10) / 10;
};

router.post('/', (req, res) => {
  try {
    const { roads, baseQuantum } = req.body;
    const quantum = Number(baseQuantum) > 0 ? Number(baseQuantum) : 10;

    // ── input validation ──────────────────────────────────────────────
    if (!roads || !Array.isArray(roads) || roads.length !== 4) {
      return res.status(400).json({
        error: 'roads must be an array of exactly 4 road objects',
      });
    }

    const isValidRoad = (r) =>
      r &&
      typeof r.id !== 'undefined' &&
      typeof r.vehicleCount === 'number' && r.vehicleCount >= 0 &&
      typeof r.waitTime === 'number'    && r.waitTime    >= 0;

    if (!roads.every(isValidRoad)) {
      return res.status(400).json({
        error: 'Each road must have id, vehicleCount >= 0, and waitTime >= 0',
      });
    }

    const roadMap = Object.fromEntries(roads.map((r) => [r.id, r]));

    // ── FCFS ─────────────────────────────────────────────────────────
    // fcfsScheduler already sorts by waitTime desc and sets step.waitTime
    // as cumulative scheduling delay (how long this road waits before green)
    const fcfsRaw = fcfsScheduler(roads);
    const fcfsResult = fcfsRaw.map((step) => ({
      ...step,
      // step.waitTime from fcfsScheduler = cumulative delay before this road's turn
      // that IS the scheduling delay — rename for clarity
      schedulingDelay: step.waitTime,
      // total wait = how long in queue before green + pre-existing input wait
      totalWait: step.waitTime + (roadMap[step.roadId]?.waitTime ?? 0),
    }));

    // ── Round Robin ───────────────────────────────────────────────────
    // roundRobinScheduler already sets step.waitTime as cumulative delay
    // but uses proportional greenTime (not fixed quantum) so delays differ from FCFS
    const rrRaw = roundRobinScheduler(roads, quantum);
    const rrResult = rrRaw.map((step) => ({
      ...step,
      schedulingDelay: step.waitTime,
      totalWait: step.waitTime + (roadMap[step.roadId]?.waitTime ?? 0),
    }));

    // ── averages & winner ─────────────────────────────────────────────
    const fcfsAvgWait = calcAvgWait(fcfsResult, roadMap);
    const rrAvgWait   = calcAvgWait(rrResult,   roadMap);

    const winner =
      fcfsAvgWait === rrAvgWait ? 'TIE'
      : rrAvgWait < fcfsAvgWait ? 'RR'
      : 'FCFS';

    res.json({
      fcfs:        fcfsResult,
      roundRobin:  rrResult,
      fcfsAvgWait,
      rrAvgWait,
      winner,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;