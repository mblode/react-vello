/**
 * Hands back a view of at least `required` bytes, with everything already
 * written preserved at the same offsets.
 *
 * The WASM implementation grows a `Vec<u8>` and returns a fresh view onto
 * linear memory; both `Vec::resize` and `memory.grow` preserve contents, so a
 * writer can grow part-way through a frame and carry on where it left off.
 */
export type GrowBuffer = (required: number) => Uint8Array;

const INITIAL_BYTES = 1 << 16;

/** Grows a plain JS buffer. Used until a GPU renderer is attached. */
export function growDetached(previous?: Uint8Array): GrowBuffer {
  let current = previous;
  return (required) => {
    if (current && current.byteLength >= required) {
      return current;
    }
    const next = new Uint8Array(required);
    if (current) {
      next.set(current);
    }
    current = next;
    return next;
  };
}

/**
 * A little-endian byte sink for one frame.
 *
 * It does not own its storage. Pointing it at WASM linear memory is what lets
 * the encoder write the frame where Rust will read it, so a frame crosses the
 * boundary as a length rather than as a megabyte of copied bytes.
 */
export class BinaryWriter {
  private bytes: Uint8Array;
  private view: DataView;
  private length = 0;
  /**
   * Tracked separately from `bytes.byteLength`, which reads as zero once the
   * underlying buffer is detached. Losing the high-water mark there would make
   * every frame re-grow from scratch.
   */
  private capacity = INITIAL_BYTES;
  private grow: GrowBuffer;

  constructor(grow: GrowBuffer = growDetached()) {
    this.grow = grow;
    this.bytes = grow(INITIAL_BYTES);
    this.view = viewOf(this.bytes);
  }

  /**
   * Points the writer at different storage. Anything already written is
   * abandoned, so only do this between frames.
   */
  setGrow(grow: GrowBuffer): void {
    this.grow = grow;
    this.adopt(grow(this.capacity));
    this.length = 0;
  }

  reset(): void {
    this.length = 0;
    // Re-derived every frame rather than reused. A view onto WASM linear memory
    // goes stale for two different reasons — the memory grows and detaches the
    // buffer, or the renderer's `Vec` is reallocated and moves — and only the
    // first of those is detectable from JS. Writing a frame through a stale
    // view puts it somewhere nothing will ever read. Two object allocations per
    // frame is not a price worth arguing over.
    this.adopt(this.grow(this.capacity));
  }

  writeUint8(value: number): void {
    this.ensureCapacity(1);
    this.view.setUint8(this.length, value);
    this.length += 1;
  }

  writeFloat32(value: number): void {
    this.ensureCapacity(4);
    this.view.setFloat32(this.length, value, true);
    this.length += 4;
  }

  writeUint32(value: number): void {
    this.ensureCapacity(4);
    this.view.setUint32(this.length, value, true);
    this.length += 4;
  }

  writeBytes(source: Uint8Array): void {
    this.ensureCapacity(source.length);
    this.bytes.set(source, this.length);
    this.length += source.length;
  }

  take(): Uint8Array {
    return this.bytes.subarray(0, this.length);
  }

  private adopt(bytes: Uint8Array): void {
    this.bytes = bytes;
    this.view = viewOf(bytes);
    this.capacity = Math.max(this.capacity, bytes.byteLength);
  }

  private ensureCapacity(size: number): void {
    const required = this.length + size;
    if (required <= this.bytes.byteLength) {
      return;
    }
    let next = Math.max(this.bytes.byteLength * 2, INITIAL_BYTES);
    while (next < required) {
      next *= 2;
    }
    this.adopt(this.grow(next));
  }
}

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
