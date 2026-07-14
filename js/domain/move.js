import { differenceInDays } from "./dates.js";

export const MOVE_PHASES = Object.freeze({
  PRE_MOVE: "pre-move",
  ARRIVAL: "arrival",
  SETTLING: "settling",
});

export function getMovePhase(moveDate, today) {
  const daysUntilMove = differenceInDays(today, moveDate);
  if (daysUntilMove > 0) return MOVE_PHASES.PRE_MOVE;
  if (daysUntilMove >= -30) return MOVE_PHASES.ARRIVAL;
  return MOVE_PHASES.SETTLING;
}

export function getMoveStatus(moveDate, today) {
  const daysUntilMove = differenceInDays(today, moveDate);
  return {
    moveDate,
    today,
    daysUntilMove,
    phase: getMovePhase(moveDate, today),
  };
}
