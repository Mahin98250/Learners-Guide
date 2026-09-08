/**
 * Central feature gates for the incremental production rollout.
 *
 * These flags intentionally keep removed/disabled experiences out of every
 * role until a later phase explicitly re-enables them.
 */
export const FEATURE_FLAGS = {
  messaging: false,
  aiChat: false,
  marks: false,
  studentResults: false,
} as const;
