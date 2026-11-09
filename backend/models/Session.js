const mongoose = require('mongoose');

const perRoadSchema = new mongoose.Schema({
  id: Number,
  name: String,
  vehicleCount: Number,
  cleared: Number,
  avgWait: Number,
  greenTimePercent: Number
});

const ganttEntrySchema = new mongoose.Schema({
  roadIndex: Number,
  roadName: String,
  color: String,
  duration: Number,
  startTime: Number
});

const sessionSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  algorithm: { type: String, enum: ['RR', 'FCFS', 'BOTH'], default: 'BOTH' },
  duration: Number,
  totalCleared: Number,
  avgWaitTime: Number,
  efficiency: Number,
  fcfsAvgWait: Number,
  rrAvgWait: Number,
  winner: { type: String, enum: ['RR', 'FCFS', 'TIE'] },
  perRoad: [perRoadSchema],
  ganttData: [ganttEntrySchema]
});

module.exports = mongoose.model('Session', sessionSchema);
