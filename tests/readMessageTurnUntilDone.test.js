import { test } from "node:test";
import assert from "node:assert/strict";
import { readMessageTurnUntilDone } from "../companion/src/nexus/neuralNexusApi.js";

// A reader that sends the reply, then holds the title frame back until
// releaseTitle is called, the way the API names a new conversation after done.
function readerWithSlowTitle() {
  const encoder = new TextEncoder();
  let releaseTitle;
  const titleSent = new Promise((resolve) => {
    releaseTitle = resolve;
  });
  const chunks = [
    'data: {"type":"assistant_token","text":"Hi there."}\n\n',
    'data: {"type":"done","content":"Hi there.","thread_id":"thread-1"}\n\n',
  ];
  let readCount = 0;
  return {
    releaseTitle,
    reader: {
      async read() {
        if (readCount < chunks.length) {
          return { done: false, value: encoder.encode(chunks[readCount++]) };
        }
        if (readCount === chunks.length) {
          readCount += 1;
          await titleSent;
          return { done: false, value: encoder.encode('data: {"type":"conversation_title","conversation_title":"Hi"}\n\n') };
        }
        return { done: true, value: undefined };
      },
      releaseLock() {},
    },
  };
}

test("the turn is returned at the done frame, before the conversation title arrives", async () => {
  const { reader, releaseTitle } = readerWithSlowTitle();
  const seenFrameTypes = [];
  const turn = await readMessageTurnUntilDone(reader, (frame) => seenFrameTypes.push(frame.type));
  assert.equal(turn.content, "Hi there.");
  assert.ok(!seenFrameTypes.includes("conversation_title"));
  releaseTitle();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(seenFrameTypes.includes("conversation_title"));
});
