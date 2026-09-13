export const MAXIMUM_QUEUED_USER_TURNS = 3;

export function enqueueUserTurn(
  queue,
  item,
  max = MAXIMUM_QUEUED_USER_TURNS
) {
  const next = [...(queue ?? []), item];
  if (next.length <= max) {
    return next;
  }
  const dropIndex = next.findIndex((entry) => entry.kind !== "typed");
  if (dropIndex !== -1 && dropIndex < next.length - 1) {
    return next.filter((_, index) => index !== dropIndex);
  }
  return next.slice(next.length - max);
}

export function companionIsBusyWithUserTurn({
  drainingTurns,
  queuedCount,
  activeUserTurnKind,
  ambientLookInFlight,
}) {
  return Boolean(
    drainingTurns ||
      queuedCount > 0 ||
      activeUserTurnKind ||
      ambientLookInFlight
  );
}
