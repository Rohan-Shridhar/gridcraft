import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decompressFrames, parseGIF } from "gifuct-js";
import { assertCompatibleFrames, encodeStoryGif } from "./gifExport.mjs";

function frame(color, durationMs) {
  const cells = Array(16 * 16).fill(null);
  cells[0] = color;
  return { gridSize: 16, cells, backgroundColor: "transparent", durationMs };
}

describe("Story GIF export", () => {
  it("encodes ordered frames with expected dimensions and delays", () => {
    const output = encodeStoryGif([frame("#ff0000", 120), frame("#00ff00", 240)], {
      scale: 2,
      loop: false,
    });
    const decoded = decompressFrames(parseGIF(output.bytes), true);

    assert.equal(output.frameCount, 2);
    assert.deepEqual([output.width, output.height], [32, 32]);
    assert.equal(decoded.length, 2);
    assert.deepEqual(decoded.map(({ dims }) => [dims.width, dims.height]), [[32, 32], [32, 32]]);
    assert.deepEqual(decoded.map(({ delay }) => delay), [120, 240]);
    assert.deepEqual(
      decoded.map(({ patch }) => [...patch.slice(0, 3)]),
      [[255, 0, 0], [0, 255, 0]]
    );
    assert.equal(decoded[0].patch[3], 255);
    assert.equal(decoded[0].patch[11], 0);
    assert.equal(parseGIF(output.bytes).frames[1].gce.delay, 24);
    assert.equal(parseGIF(output.bytes).frames[0].application, undefined);
    const looping = parseGIF(encodeStoryGif([frame("#ff0000", 120)], { scale: 1, loop: true }).bytes);
    assert.deepEqual([...looping.frames[0].application.blocks], [1, 0, 0]);
  });

  it("rejects empty, mixed-size, and excessive Stories", () => {
    assert.throws(() => assertCompatibleFrames([]), /at least one frame/);
    assert.throws(() => assertCompatibleFrames([frame("#ff0000", 100), { ...frame("#00ff00", 100), gridSize: 32 }]), /same grid size/);
    assert.throws(() => assertCompatibleFrames(Array(121).fill(frame("#ff0000", 100))), /at most 120/);
  });
});
