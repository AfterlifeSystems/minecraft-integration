/**
 * Parse Neural Nexus SSE the same way Neural-Nexus-Frontend does:
 * frames split on a blank line, each data: line is JSON.
 */

export function parseServerSentEventFrame(frameText) {
  const payloads = [];
  for (const rawLine of String(frameText || "").split(/\r?\n/)) {
    if (!rawLine.startsWith("data:")) {
      continue;
    }
    const dataText = rawLine.slice("data:".length).trim();
    if (!dataText || dataText.startsWith(":")) {
      continue;
    }
    try {
      payloads.push(JSON.parse(dataText));
    } catch {
      payloads.push({ type: "unparsed", text: dataText });
    }
  }
  return payloads;
}

export function consumeServerSentEventBuffer(bufferText) {
  const frames = [];
  let remaining = bufferText;
  let boundary = remaining.indexOf("\n\n");
  while (boundary !== -1) {
    const frameText = remaining.slice(0, boundary);
    remaining = remaining.slice(boundary + 2);
    frames.push(...parseServerSentEventFrame(frameText));
    boundary = remaining.indexOf("\n\n");
  }
  return { frames, remaining };
}

export function collectMessageTurnFromFrames(frames) {
  const collected = {
    requestId: null,
    threadId: null,
    content: "",
    ambientDecision: null,
    spokenTurnText: "",
    stopped: false,
    interrupt: null,
  };
  for (const frame of frames) {
    if (!frame || typeof frame !== "object") {
      continue;
    }
    if (frame.type === "spoken_turn") {
      collected.spokenTurnText = String(
        frame.content || frame.script || collected.spokenTurnText
      );
    }
    if (frame.type === "turn_started") {
      collected.requestId = frame.request_id ?? collected.requestId;
      collected.threadId = frame.thread_id ?? collected.threadId;
    }
    if (frame.type === "assistant_token" && frame.text) {
      collected.content += frame.text;
    }
    if (frame.type === "ambient_decision") {
      collected.ambientDecision = frame;
    }
    if (frame.type === "interrupt") {
      collected.interrupt = frame.interrupt || null;
      collected.threadId = frame.thread_id ?? collected.threadId;
      collected.requestId = frame.request_id ?? collected.requestId;
    }
    if (frame.type === "done") {
      collected.content = frame.content ?? collected.content;
      collected.threadId = frame.thread_id ?? collected.threadId;
      collected.requestId = frame.request_id ?? collected.requestId;
      collected.stopped = Boolean(frame.stopped);
      if (frame.ambient) {
        collected.ambientDecision = frame.ambient;
      }
    }
  }
  return collected;
}
