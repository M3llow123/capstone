// Crop requirement profiles and scoring weights used by the recommendation engine.
//
// IMPORTANT: every number in this file is a CONFIGURABLE PLACEHOLDER chosen to give the
// engine a sensible shape. None of it has been validated by an agronomist. Before this is
// shown to farmers as advice, have the thresholds reviewed against PhilRice / DA-BAR /
// local DA-RFO guidance for the target region and variety, then set `validated: true`.
// Keep the values in one place so they can later move to a database table that
// PAGASA/agri staff can edit from the admin side.

import type { Crop } from "./types";

/** Trapezoid: 0 outside [min,max], 100 inside [optMin,optMax], linear in between. */
export interface Range {
  min: number;
  optMin: number;
  optMax: number;
  max: number;
}

export interface CropProfile {
  crop: Crop;
  validated: boolean;
  validationNote: string;
  /** monthly rainfall (mm) that supports the crop when it relies on rain */
  rainfedMonthlyRainMm: Range;
  /** monthly rainfall (mm) tolerable when irrigation supplies water (mainly an excess/flood check) */
  irrigatedMonthlyRainMm: Range;
  meanTempC: Range;
  /** mean daily max temperature above which heat stress is flagged */
  heatStressTmaxC: number;
  /** longest dry spell (days) that is still fine / that is considered harmful for rain-dependent crops */
  drySpellOkDays: number;
  drySpellBadDays: number;
  /** planting month and following month, weights for the early-establishment window */
  windowWeights: [number, number];
  /** forecast next-N-days rainfall (mm) supporting establishment */
  forecastWindowDays: number;
  forecastRainMm: Range;
  gustWarnKmh: number;
  heavyDayWarnMm: number;
  /** indicative crop duration in days; varies by variety, used only for estimates */
  durationDays: { min: number; max: number };
}

export interface ScoringConfig {
  weights: { rainfall: number; temperature: number; forecast: number; water: number; risk: number };
  bands: { favorable: number; moderate: number; less: number }; // score >= band => category
  /** the engine's coverage logic lives in recommendation.ts; these are the essential factors */
  essential: { historical: Array<"rainfall" | "temperature">; current: Array<"rainfall" | "temperature" | "forecast"> };
}

export const DEFAULT_SCORING: ScoringConfig = {
  weights: { rainfall: 0.30, temperature: 0.20, forecast: 0.15, water: 0.15, risk: 0.20 },
  bands: { favorable: 75, moderate: 60, less: 40 },
  essential: { historical: ["rainfall", "temperature"], current: ["rainfall", "temperature", "forecast"] },
};

const NOTE =
  "Placeholder thresholds - not yet validated by an agronomist. Review against PhilRice/DA guidance before relying on them.";

export const CROP_PROFILES: Record<Crop, CropProfile> = {
  rice: {
    crop: "rice",
    validated: false,
    validationNote: NOTE,
    rainfedMonthlyRainMm: { min: 100, optMin: 200, optMax: 450, max: 700 },
    irrigatedMonthlyRainMm: { min: 0, optMin: 50, optMax: 400, max: 700 },
    meanTempC: { min: 18, optMin: 24, optMax: 30, max: 35 },
    heatStressTmaxC: 35,
    drySpellOkDays: 4,
    drySpellBadDays: 12,
    windowWeights: [0.6, 0.4],
    forecastWindowDays: 7,
    forecastRainMm: { min: 10, optMin: 40, optMax: 150, max: 300 },
    gustWarnKmh: 60,
    heavyDayWarnMm: 50,
    durationDays: { min: 100, max: 130 },
  },
  corn: {
    crop: "corn",
    validated: false,
    validationNote: NOTE,
    rainfedMonthlyRainMm: { min: 60, optMin: 100, optMax: 250, max: 400 },
    irrigatedMonthlyRainMm: { min: 0, optMin: 30, optMax: 250, max: 400 },
    meanTempC: { min: 16, optMin: 21, optMax: 30, max: 36 },
    heatStressTmaxC: 35,
    drySpellOkDays: 7,
    drySpellBadDays: 18,
    windowWeights: [0.6, 0.4],
    forecastWindowDays: 7,
    forecastRainMm: { min: 5, optMin: 20, optMax: 80, max: 200 },
    gustWarnKmh: 50, // corn lodges more easily than rice
    heavyDayWarnMm: 50,
    durationDays: { min: 95, max: 125 },
  },
};
