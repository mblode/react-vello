/** Frames kept for percentiles. At 60fps this is a four-second window. */
const SAMPLE_COUNT = 240;

export interface Percentiles {
  p50: number;
  p95: number;
  p99: number;
}

export interface FrameStats {
  /** Frames in the current window. */
  frames: number;
  /** Milliseconds walking the scene graph into the frame buffer. */
  encode: Percentiles;
  /** Milliseconds inside the WASM boundary: apply plus render. */
  submit: Percentiles;
  /** Bytes written for the most recent frame. */
  bytes: number;
  /** Draw ops written for the most recent frame. */
  ops: number;
}

const EMPTY: Percentiles = { p50: 0, p95: 0, p99: 0 };

/**
 * A ring of per-stage frame times. Percentiles rather than a mean, because a
 * mean is exactly the statistic that hides a GC pause: sixty good frames and
 * one 40ms stall average out to something that looks fine.
 *
 * Off unless the root was created with `debug: true`; the collector is only
 * allocated in that case, so the timing calls cost a branch in release.
 */
export class FrameStatsCollector {
  private readonly encodeSamples = new Float64Array(SAMPLE_COUNT);
  private readonly submitSamples = new Float64Array(SAMPLE_COUNT);
  private readonly scratch = new Float64Array(SAMPLE_COUNT);
  private cursor = 0;
  private filled = 0;
  private bytes = 0;
  private ops = 0;

  record(encodeMs: number, submitMs: number, bytes: number, ops: number): void {
    this.encodeSamples[this.cursor] = encodeMs;
    this.submitSamples[this.cursor] = submitMs;
    this.cursor = (this.cursor + 1) % SAMPLE_COUNT;
    this.filled = Math.min(this.filled + 1, SAMPLE_COUNT);
    this.bytes = bytes;
    this.ops = ops;
  }

  read(): FrameStats {
    return {
      frames: this.filled,
      encode: this.percentiles(this.encodeSamples),
      submit: this.percentiles(this.submitSamples),
      bytes: this.bytes,
      ops: this.ops,
    };
  }

  reset(): void {
    this.cursor = 0;
    this.filled = 0;
    this.bytes = 0;
    this.ops = 0;
  }

  private percentiles(samples: Float64Array): Percentiles {
    if (this.filled === 0) {
      return EMPTY;
    }
    const window = this.scratch.subarray(0, this.filled);
    window.set(samples.subarray(0, this.filled));
    window.sort();
    return {
      p50: at(window, 0.5),
      p95: at(window, 0.95),
      p99: at(window, 0.99),
    };
  }
}

function at(sorted: Float64Array, quantile: number): number {
  const index = Math.min(
    sorted.length - 1,
    Math.floor(quantile * sorted.length)
  );
  return sorted[index] ?? 0;
}
