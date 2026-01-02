let wasm;

function debugString(val) {
  // primitive types
  const type = typeof val;
  if (type == "number" || type == "boolean" || val == null) {
    return `${val}`;
  }
  if (type == "string") {
    return `"${val}"`;
  }
  if (type == "symbol") {
    const description = val.description;
    if (description == null) {
      return "Symbol";
    } else {
      return `Symbol(${description})`;
    }
  }
  if (type == "function") {
    const name = val.name;
    if (typeof name == "string" && name.length > 0) {
      return `Function(${name})`;
    } else {
      return "Function";
    }
  }
  // objects
  if (Array.isArray(val)) {
    const length = val.length;
    let debug = "[";
    if (length > 0) {
      debug += debugString(val[0]);
    }
    for (let i = 1; i < length; i++) {
      debug += ", " + debugString(val[i]);
    }
    debug += "]";
    return debug;
  }
  // Test for built-in
  const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
  let className;
  if (builtInMatches && builtInMatches.length > 1) {
    className = builtInMatches[1];
  } else {
    // Failed to match the standard '[object ClassName]'
    return toString.call(val);
  }
  if (className == "Object") {
    // we're a user defined class or Object
    // JSON.stringify avoids problems with cycles, and is generally much
    // easier than looping through ownProperties of `val`.
    try {
      return "Object(" + JSON.stringify(val) + ")";
    } catch (_) {
      return "Object";
    }
  }
  // errors
  if (val instanceof Error) {
    return `${val.name}: ${val.message}\n${val.stack}`;
  }
  // TODO we could test for more things here, like `Set`s and `Map`s.
  return className;
}

let WASM_VECTOR_LEN = 0;

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
  if (
    cachedUint8ArrayMemory0 === null ||
    cachedUint8ArrayMemory0.byteLength === 0
  ) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}

const cachedTextEncoder = new TextEncoder();

if (!("encodeInto" in cachedTextEncoder)) {
  cachedTextEncoder.encodeInto = function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
      read: arg.length,
      written: buf.length,
    };
  };
}

function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === undefined) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr = malloc(buf.length, 1) >>> 0;
    getUint8ArrayMemory0()
      .subarray(ptr, ptr + buf.length)
      .set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr;
  }

  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;

  const mem = getUint8ArrayMemory0();

  let offset = 0;

  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 0x7f) break;
    mem[ptr + offset] = code;
  }

  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, (len = offset + arg.length * 3), 1) >>> 0;
    const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
    const ret = cachedTextEncoder.encodeInto(arg, view);

    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }

  WASM_VECTOR_LEN = offset;
  return ptr;
}

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
  if (
    cachedDataViewMemory0 === null ||
    cachedDataViewMemory0.buffer.detached === true ||
    (cachedDataViewMemory0.buffer.detached === undefined &&
      cachedDataViewMemory0.buffer !== wasm.memory.buffer)
  ) {
    cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
  }
  return cachedDataViewMemory0;
}

function isLikeNone(x) {
  return x === undefined || x === null;
}

let cachedTextDecoder = new TextDecoder("utf-8", {
  ignoreBOM: true,
  fatal: true,
});

cachedTextDecoder.decode();

const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
  numBytesDecoded += len;
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder("utf-8", {
      ignoreBOM: true,
      fatal: true,
    });
    cachedTextDecoder.decode();
    numBytesDecoded = len;
  }
  return cachedTextDecoder.decode(
    getUint8ArrayMemory0().subarray(ptr, ptr + len)
  );
}

function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return decodeText(ptr, len);
}

function addToExternrefTable0(obj) {
  const idx = wasm.__externref_table_alloc();
  wasm.__wbindgen_externrefs.set(idx, obj);
  return idx;
}

function handleError(f, args) {
  try {
    return f.apply(this, args);
  } catch (e) {
    const idx = addToExternrefTable0(e);
    wasm.__wbindgen_exn_store(idx);
  }
}

function getArrayU8FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedUint32ArrayMemory0 = null;

function getUint32ArrayMemory0() {
  if (
    cachedUint32ArrayMemory0 === null ||
    cachedUint32ArrayMemory0.byteLength === 0
  ) {
    cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
  }
  return cachedUint32ArrayMemory0;
}

function getArrayU32FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

const CLOSURE_DTORS =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((state) => state.dtor(state.a, state.b));

function makeMutClosure(arg0, arg1, dtor, f) {
  const state = { a: arg0, b: arg1, cnt: 1, dtor };
  const real = (...args) => {
    // First up with a closure we increment the internal reference
    // count. This ensures that the Rust closure environment won't
    // be deallocated while we're invoking it.
    state.cnt++;
    const a = state.a;
    state.a = 0;
    try {
      return f(a, state.b, ...args);
    } finally {
      state.a = a;
      real._wbg_cb_unref();
    }
  };
  real._wbg_cb_unref = () => {
    if (--state.cnt === 0) {
      state.dtor(state.a, state.b);
      state.a = 0;
      CLOSURE_DTORS.unregister(state);
    }
  };
  CLOSURE_DTORS.register(real, state, state);
  return real;
}

function takeFromExternrefTable0(idx) {
  const value = wasm.__wbindgen_externrefs.get(idx);
  wasm.__externref_table_dealloc(idx);
  return value;
}
/**
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<RendererHandle>}
 */
export function create_renderer(canvas) {
  const ret = wasm.create_renderer(canvas);
  return ret;
}

export function wasm_start() {
  wasm.wasm_start();
}

function wasm_bindgen__convert__closures_____invoke__h1e3f4f5e5b6e003f(
  arg0,
  arg1,
  arg2
) {
  wasm.wasm_bindgen__convert__closures_____invoke__h1e3f4f5e5b6e003f(
    arg0,
    arg1,
    arg2
  );
}

function wasm_bindgen__convert__closures_____invoke__h2a0f84921f614cc0(
  arg0,
  arg1,
  arg2,
  arg3
) {
  wasm.wasm_bindgen__convert__closures_____invoke__h2a0f84921f614cc0(
    arg0,
    arg1,
    arg2,
    arg3
  );
}

const __wbindgen_enum_GpuAddressMode = [
  "clamp-to-edge",
  "repeat",
  "mirror-repeat",
];

const __wbindgen_enum_GpuBlendFactor = [
  "zero",
  "one",
  "src",
  "one-minus-src",
  "src-alpha",
  "one-minus-src-alpha",
  "dst",
  "one-minus-dst",
  "dst-alpha",
  "one-minus-dst-alpha",
  "src-alpha-saturated",
  "constant",
  "one-minus-constant",
  "src1",
  "one-minus-src1",
  "src1-alpha",
  "one-minus-src1-alpha",
];

const __wbindgen_enum_GpuBlendOperation = [
  "add",
  "subtract",
  "reverse-subtract",
  "min",
  "max",
];

const __wbindgen_enum_GpuBufferBindingType = [
  "uniform",
  "storage",
  "read-only-storage",
];

const __wbindgen_enum_GpuCanvasAlphaMode = ["opaque", "premultiplied"];

const __wbindgen_enum_GpuCompareFunction = [
  "never",
  "less",
  "equal",
  "less-equal",
  "greater",
  "not-equal",
  "greater-equal",
  "always",
];

const __wbindgen_enum_GpuCullMode = ["none", "front", "back"];

const __wbindgen_enum_GpuFilterMode = ["nearest", "linear"];

const __wbindgen_enum_GpuFrontFace = ["ccw", "cw"];

const __wbindgen_enum_GpuIndexFormat = ["uint16", "uint32"];

const __wbindgen_enum_GpuLoadOp = ["load", "clear"];

const __wbindgen_enum_GpuMipmapFilterMode = ["nearest", "linear"];

const __wbindgen_enum_GpuPowerPreference = ["low-power", "high-performance"];

const __wbindgen_enum_GpuPrimitiveTopology = [
  "point-list",
  "line-list",
  "line-strip",
  "triangle-list",
  "triangle-strip",
];

const __wbindgen_enum_GpuSamplerBindingType = [
  "filtering",
  "non-filtering",
  "comparison",
];

const __wbindgen_enum_GpuStencilOperation = [
  "keep",
  "zero",
  "replace",
  "invert",
  "increment-clamp",
  "decrement-clamp",
  "increment-wrap",
  "decrement-wrap",
];

const __wbindgen_enum_GpuStorageTextureAccess = [
  "write-only",
  "read-only",
  "read-write",
];

const __wbindgen_enum_GpuStoreOp = ["store", "discard"];

const __wbindgen_enum_GpuTextureAspect = ["all", "stencil-only", "depth-only"];

const __wbindgen_enum_GpuTextureDimension = ["1d", "2d", "3d"];

const __wbindgen_enum_GpuTextureFormat = [
  "r8unorm",
  "r8snorm",
  "r8uint",
  "r8sint",
  "r16uint",
  "r16sint",
  "r16float",
  "rg8unorm",
  "rg8snorm",
  "rg8uint",
  "rg8sint",
  "r32uint",
  "r32sint",
  "r32float",
  "rg16uint",
  "rg16sint",
  "rg16float",
  "rgba8unorm",
  "rgba8unorm-srgb",
  "rgba8snorm",
  "rgba8uint",
  "rgba8sint",
  "bgra8unorm",
  "bgra8unorm-srgb",
  "rgb9e5ufloat",
  "rgb10a2uint",
  "rgb10a2unorm",
  "rg11b10ufloat",
  "rg32uint",
  "rg32sint",
  "rg32float",
  "rgba16uint",
  "rgba16sint",
  "rgba16float",
  "rgba32uint",
  "rgba32sint",
  "rgba32float",
  "stencil8",
  "depth16unorm",
  "depth24plus",
  "depth24plus-stencil8",
  "depth32float",
  "depth32float-stencil8",
  "bc1-rgba-unorm",
  "bc1-rgba-unorm-srgb",
  "bc2-rgba-unorm",
  "bc2-rgba-unorm-srgb",
  "bc3-rgba-unorm",
  "bc3-rgba-unorm-srgb",
  "bc4-r-unorm",
  "bc4-r-snorm",
  "bc5-rg-unorm",
  "bc5-rg-snorm",
  "bc6h-rgb-ufloat",
  "bc6h-rgb-float",
  "bc7-rgba-unorm",
  "bc7-rgba-unorm-srgb",
  "etc2-rgb8unorm",
  "etc2-rgb8unorm-srgb",
  "etc2-rgb8a1unorm",
  "etc2-rgb8a1unorm-srgb",
  "etc2-rgba8unorm",
  "etc2-rgba8unorm-srgb",
  "eac-r11unorm",
  "eac-r11snorm",
  "eac-rg11unorm",
  "eac-rg11snorm",
  "astc-4x4-unorm",
  "astc-4x4-unorm-srgb",
  "astc-5x4-unorm",
  "astc-5x4-unorm-srgb",
  "astc-5x5-unorm",
  "astc-5x5-unorm-srgb",
  "astc-6x5-unorm",
  "astc-6x5-unorm-srgb",
  "astc-6x6-unorm",
  "astc-6x6-unorm-srgb",
  "astc-8x5-unorm",
  "astc-8x5-unorm-srgb",
  "astc-8x6-unorm",
  "astc-8x6-unorm-srgb",
  "astc-8x8-unorm",
  "astc-8x8-unorm-srgb",
  "astc-10x5-unorm",
  "astc-10x5-unorm-srgb",
  "astc-10x6-unorm",
  "astc-10x6-unorm-srgb",
  "astc-10x8-unorm",
  "astc-10x8-unorm-srgb",
  "astc-10x10-unorm",
  "astc-10x10-unorm-srgb",
  "astc-12x10-unorm",
  "astc-12x10-unorm-srgb",
  "astc-12x12-unorm",
  "astc-12x12-unorm-srgb",
];

const __wbindgen_enum_GpuTextureSampleType = [
  "float",
  "unfilterable-float",
  "depth",
  "sint",
  "uint",
];

const __wbindgen_enum_GpuTextureViewDimension = [
  "1d",
  "2d",
  "2d-array",
  "cube",
  "cube-array",
  "3d",
];

const __wbindgen_enum_GpuVertexFormat = [
  "uint8",
  "uint8x2",
  "uint8x4",
  "sint8",
  "sint8x2",
  "sint8x4",
  "unorm8",
  "unorm8x2",
  "unorm8x4",
  "snorm8",
  "snorm8x2",
  "snorm8x4",
  "uint16",
  "uint16x2",
  "uint16x4",
  "sint16",
  "sint16x2",
  "sint16x4",
  "unorm16",
  "unorm16x2",
  "unorm16x4",
  "snorm16",
  "snorm16x2",
  "snorm16x4",
  "float16",
  "float16x2",
  "float16x4",
  "float32",
  "float32x2",
  "float32x3",
  "float32x4",
  "uint32",
  "uint32x2",
  "uint32x3",
  "uint32x4",
  "sint32",
  "sint32x2",
  "sint32x3",
  "sint32x4",
  "unorm10-10-10-2",
  "unorm8x4-bgra",
];

const __wbindgen_enum_GpuVertexStepMode = ["vertex", "instance"];

const RendererHandleFinalization =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) =>
        wasm.__wbg_rendererhandle_free(ptr >>> 0, 1)
      );

export class RendererHandle {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(RendererHandle.prototype);
    obj.__wbg_ptr = ptr;
    RendererHandleFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }

  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    RendererHandleFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_rendererhandle_free(ptr, 0);
  }
  /**
   * @param {Uint8Array} ops
   */
  apply(ops) {
    const ret = wasm.rendererhandle_apply(this.__wbg_ptr, ops);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  render() {
    const ret = wasm.rendererhandle_render(this.__wbg_ptr);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    wasm.rendererhandle_resize(this.__wbg_ptr, width, height);
  }
}
if (Symbol.dispose)
  RendererHandle.prototype[Symbol.dispose] = RendererHandle.prototype.free;

const EXPECTED_RESPONSE_TYPES = new Set(["basic", "cors", "default"]);

async function __wbg_load(module, imports) {
  if (typeof Response === "function" && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        const validResponse =
          module.ok && EXPECTED_RESPONSE_TYPES.has(module.type);

        if (
          validResponse &&
          module.headers.get("Content-Type") !== "application/wasm"
        ) {
          console.warn(
            "`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n",
            e
          );
        } else {
          throw e;
        }
      }
    }

    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);

    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }
}

function __wbg_get_imports() {
  const imports = {};
  imports.wbg = {};
  imports.wbg.__wbg_Window_a4c5a48392f234ba = function (arg0) {
    const ret = arg0.Window;
    return ret;
  };
  imports.wbg.__wbg_WorkerGlobalScope_2b2b89e1ac952b50 = function (arg0) {
    const ret = arg0.WorkerGlobalScope;
    return ret;
  };
  imports.wbg.__wbg___wbindgen_debug_string_df47ffb5e35e6763 = function (
    arg0,
    arg1
  ) {
    const ret = debugString(arg1);
    const ptr1 = passStringToWasm0(
      ret,
      wasm.__wbindgen_malloc,
      wasm.__wbindgen_realloc
    );
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
  };
  imports.wbg.__wbg___wbindgen_is_function_ee8a6c5833c90377 = function (arg0) {
    const ret = typeof arg0 === "function";
    return ret;
  };
  imports.wbg.__wbg___wbindgen_is_null_5e69f72e906cc57c = function (arg0) {
    const ret = arg0 === null;
    return ret;
  };
  imports.wbg.__wbg___wbindgen_is_undefined_2d472862bd29a478 = function (arg0) {
    const ret = arg0 === undefined;
    return ret;
  };
  imports.wbg.__wbg___wbindgen_string_get_e4f06c90489ad01b = function (
    arg0,
    arg1
  ) {
    const obj = arg1;
    const ret = typeof obj === "string" ? obj : undefined;
    var ptr1 = isLikeNone(ret)
      ? 0
      : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
  };
  imports.wbg.__wbg___wbindgen_throw_b855445ff6a94295 = function (arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
  };
  imports.wbg.__wbg__wbg_cb_unref_2454a539ea5790d9 = function (arg0) {
    arg0._wbg_cb_unref();
  };
  imports.wbg.__wbg_beginComputePass_304dccb30a4db2cc = function (arg0, arg1) {
    const ret = arg0.beginComputePass(arg1);
    return ret;
  };
  imports.wbg.__wbg_beginRenderPass_2bc62f5f78642ee0 = function () {
    return handleError(function (arg0, arg1) {
      const ret = arg0.beginRenderPass(arg1);
      return ret;
    }, arguments);
  };
  imports.wbg.__wbg_buffer_ccc4520b36d3ccf4 = function (arg0) {
    const ret = arg0.buffer;
    return ret;
  };
  imports.wbg.__wbg_call_525440f72fbfc0ea = function () {
    return handleError(function (arg0, arg1, arg2) {
      const ret = arg0.call(arg1, arg2);
      return ret;
    }, arguments);
  };
  imports.wbg.__wbg_call_e762c39fa8ea36bf = function () {
    return handleError(function (arg0, arg1) {
      const ret = arg0.call(arg1);
      return ret;
    }, arguments);
  };
  imports.wbg.__wbg_clearBuffer_b7d0381b50c8f5bb = function (
    arg0,
    arg1,
    arg2,
    arg3
  ) {
    arg0.clearBuffer(arg1, arg2, arg3);
  };
  imports.wbg.__wbg_clearBuffer_e3fa352fcc8ecc67 = function (arg0, arg1, arg2) {
    arg0.clearBuffer(arg1, arg2);
  };
  imports.wbg.__wbg_configure_bced8e40e8dbaaa0 = function () {
    return handleError(function (arg0, arg1) {
      arg0.configure(arg1);
    }, arguments);
  };
  imports.wbg.__wbg_copyBufferToBuffer_38cb6919320bd451 = function () {
    return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5) {
      arg0.copyBufferToBuffer(arg1, arg2, arg3, arg4, arg5);
    }, arguments);
  };
  imports.wbg.__wbg_copyBufferToBuffer_8db6b1d1ef2bcea4 = function () {
    return handleError(function (arg0, arg1, arg2, arg3, arg4) {
      arg0.copyBufferToBuffer(arg1, arg2, arg3, arg4);
    }, arguments);
  };
  imports.wbg.__wbg_copyTextureToTexture_0eb51a215ab2cc31 = function () {
    return handleError(function (arg0, arg1, arg2, arg3) {
      arg0.copyTextureToTexture(arg1, arg2, arg3);
    }, arguments);
  };
  imports.wbg.__wbg_createBindGroupLayout_3fb59c14aed4b64e = function () {
    return handleError(function (arg0, arg1) {
      const ret = arg0.createBindGroupLayout(arg1);
      return ret;
    }, arguments);
  };
  imports.wbg.__wbg_createBindGroup_03f26b8770895116 = function (arg0, arg1) {
    const ret = arg0.createBindGroup(arg1);
    return ret;
  };
  imports.wbg.__wbg_createBuffer_76f7598789ecc3d7 = function () {
    return handleError(function (arg0, arg1) {
      const ret = arg0.createBuffer(arg1);
      return ret;
    }, arguments);
  };
  imports.wbg.__wbg_createCommandEncoder_f8056019328bd192 = function (
    arg0,
    arg1
  ) {
    const ret = arg0.createCommandEncoder(arg1);
    return ret;
  };
  imports.wbg.__wbg_createComputePipeline_e6192c920efba35b = function (
    arg0,
    arg1
  ) {
    const ret = arg0.createComputePipeline(arg1);
    return ret;
  };
  imports.wbg.__wbg_createPipelineLayout_5039b0679b6b7f36 = function (
    arg0,
    arg1
  ) {
    const ret = arg0.createPipelineLayout(arg1);
    return ret;
  };
  imports.wbg.__wbg_createRenderPipeline_db585efa9bab66f3 = function () {
    return handleError(function (arg0, arg1) {
      const ret = arg0.createRenderPipeline(arg1);
      return ret;
    }, arguments);
  };
  imports.wbg.__wbg_createSampler_e421d07197c6e5ec = function (arg0, arg1) {
    const ret = arg0.createSampler(arg1);
    return ret;
  };
  imports.wbg.__wbg_createShaderModule_3facfe98356b79a9 = function (
    arg0,
    arg1
  ) {
    const ret = arg0.createShaderModule(arg1);
    return ret;
  };
  imports.wbg.__wbg_createTexture_49002c91188f6137 = function () {
    return handleError(function (arg0, arg1) {
      const ret = arg0.createTexture(arg1);
      return ret;
    }, arguments);
  };
  imports.wbg.__wbg_createView_0ce5c82d78f482df = function () {
    return handleError(function (arg0, arg1) {
      const ret = arg0.createView(arg1);
      return ret;
    }, arguments);
  };
  imports.wbg.__wbg_dispatchWorkgroupsIndirect_6594fbc416b287d6 = function (
    arg0,
    arg1,
    arg2
  ) {
    arg0.dispatchWorkgroupsIndirect(arg1, arg2);
  };
  imports.wbg.__wbg_dispatchWorkgroups_4e59e078119b5bab = function (
    arg0,
    arg1,
    arg2,
    arg3
  ) {
    arg0.dispatchWorkgroups(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0);
  };
  imports.wbg.__wbg_document_725ae06eb442a6db = function (arg0) {
    const ret = arg0.document;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
  };
  imports.wbg.__wbg_draw_d3b53fbcc9853635 = function (
    arg0,
    arg1,
    arg2,
    arg3,
    arg4
  ) {
    arg0.draw(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4 >>> 0);
  };
  imports.wbg.__wbg_end_b9d7079f54620f76 = function (arg0) {
    arg0.end();
  };
  imports.wbg.__wbg_end_ece2bf3a25678f12 = function (arg0) {
    arg0.end();
  };
  imports.wbg.__wbg_error_7534b8e9a36f1ab4 = function (arg0, arg1) {
    let deferred0_0;
    let deferred0_1;
    try {
      deferred0_0 = arg0;
      deferred0_1 = arg1;
      console.error(getStringFromWasm0(arg0, arg1));
    } finally {
      wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
    }
  };
  imports.wbg.__wbg_features_1e615dfe5ee66265 = function (arg0) {
    const ret = arg0.features;
    return ret;
  };
  imports.wbg.__wbg_finish_17a0b297901010d5 = function (arg0) {
    const ret = arg0.finish();
    return ret;
  };
  imports.wbg.__wbg_finish_ab9e01a922269f3a = function (arg0, arg1) {
    const ret = arg0.finish(arg1);
    return ret;
  };
  imports.wbg.__wbg_getContext_0b80ccb9547db509 = function () {
    return handleError(function (arg0, arg1, arg2) {
      const ret = arg0.getContext(getStringFromWasm0(arg1, arg2));
      return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    }, arguments);
  };
  imports.wbg.__wbg_getContext_d1c8d1b1701886ce = function () {
    return handleError(function (arg0, arg1, arg2) {
      const ret = arg0.getContext(getStringFromWasm0(arg1, arg2));
      return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    }, arguments);
  };
  imports.wbg.__wbg_getCurrentTexture_d64323b76f42d5e0 = function () {
    return handleError(function (arg0) {
      const ret = arg0.getCurrentTexture();
      return ret;
    }, arguments);
  };
  imports.wbg.__wbg_getPreferredCanvasFormat_9aef34efead2aa08 = function (
    arg0
  ) {
    const ret = arg0.getPreferredCanvasFormat();
    return (__wbindgen_enum_GpuTextureFormat.indexOf(ret) + 1 || 96) - 1;
  };
  imports.wbg.__wbg_get_3069852592aa5a9c = function (arg0, arg1) {
    const ret = arg0[arg1 >>> 0];
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
  };
  imports.wbg.__wbg_gpu_a6bce2913fb8f574 = function (arg0) {
    const ret = arg0.gpu;
    return ret;
  };
  imports.wbg.__wbg_has_4891bec062ded753 = function (arg0, arg1, arg2) {
    const ret = arg0.has(getStringFromWasm0(arg1, arg2));
    return ret;
  };
  imports.wbg.__wbg_height_119077665279308c = function (arg0) {
    const ret = arg0.height;
    return ret;
  };
  imports.wbg.__wbg_instanceof_GpuAdapter_fb230cdccb184887 = function (arg0) {
    let result;
    try {
      result = arg0 instanceof GPUAdapter;
    } catch (_) {
      result = false;
    }
    const ret = result;
    return ret;
  };
  imports.wbg.__wbg_instanceof_GpuCanvasContext_48ec5330c4425d84 = function (
    arg0
  ) {
    let result;
    try {
      result = arg0 instanceof GPUCanvasContext;
    } catch (_) {
      result = false;
    }
    const ret = result;
    return ret;
  };
  imports.wbg.__wbg_instanceof_Window_4846dbb3de56c84c = function (arg0) {
    let result;
    try {
      result = arg0 instanceof Window;
    } catch (_) {
      result = false;
    }
    const ret = result;
    return ret;
  };
  imports.wbg.__wbg_label_cda985b32d44cee0 = function (arg0, arg1) {
    const ret = arg1.label;
    const ptr1 = passStringToWasm0(
      ret,
      wasm.__wbindgen_malloc,
      wasm.__wbindgen_realloc
    );
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
  };
  imports.wbg.__wbg_length_69bca3cb64fc8748 = function (arg0) {
    const ret = arg0.length;
    return ret;
  };
  imports.wbg.__wbg_limits_79ab67d5f10db979 = function (arg0) {
    const ret = arg0.limits;
    return ret;
  };
  imports.wbg.__wbg_maxBindGroups_c88520bb1d32bb51 = function (arg0) {
    const ret = arg0.maxBindGroups;
    return ret;
  };
  imports.wbg.__wbg_maxBindingsPerBindGroup_432afc05fd4d1473 = function (arg0) {
    const ret = arg0.maxBindingsPerBindGroup;
    return ret;
  };
  imports.wbg.__wbg_maxBufferSize_b67a4c44cc76ddc3 = function (arg0) {
    const ret = arg0.maxBufferSize;
    return ret;
  };
  imports.wbg.__wbg_maxColorAttachmentBytesPerSample_2b29886758adffb4 =
    function (arg0) {
      const ret = arg0.maxColorAttachmentBytesPerSample;
      return ret;
    };
  imports.wbg.__wbg_maxColorAttachments_ec0f3f73d0af16a4 = function (arg0) {
    const ret = arg0.maxColorAttachments;
    return ret;
  };
  imports.wbg.__wbg_maxComputeInvocationsPerWorkgroup_ea57344834f1a195 =
    function (arg0) {
      const ret = arg0.maxComputeInvocationsPerWorkgroup;
      return ret;
    };
  imports.wbg.__wbg_maxComputeWorkgroupSizeX_b924545971550146 = function (
    arg0
  ) {
    const ret = arg0.maxComputeWorkgroupSizeX;
    return ret;
  };
  imports.wbg.__wbg_maxComputeWorkgroupSizeY_c0d9d68b1acecdc1 = function (
    arg0
  ) {
    const ret = arg0.maxComputeWorkgroupSizeY;
    return ret;
  };
  imports.wbg.__wbg_maxComputeWorkgroupSizeZ_3898cfa28ca6d14f = function (
    arg0
  ) {
    const ret = arg0.maxComputeWorkgroupSizeZ;
    return ret;
  };
  imports.wbg.__wbg_maxComputeWorkgroupStorageSize_edea548daf4af87d = function (
    arg0
  ) {
    const ret = arg0.maxComputeWorkgroupStorageSize;
    return ret;
  };
  imports.wbg.__wbg_maxComputeWorkgroupsPerDimension_bfc346c1292145d9 =
    function (arg0) {
      const ret = arg0.maxComputeWorkgroupsPerDimension;
      return ret;
    };
  imports.wbg.__wbg_maxDynamicStorageBuffersPerPipelineLayout_e7359e7bdfc76801 =
    function (arg0) {
      const ret = arg0.maxDynamicStorageBuffersPerPipelineLayout;
      return ret;
    };
  imports.wbg.__wbg_maxDynamicUniformBuffersPerPipelineLayout_8beefcf6b6ae3a02 =
    function (arg0) {
      const ret = arg0.maxDynamicUniformBuffersPerPipelineLayout;
      return ret;
    };
  imports.wbg.__wbg_maxSampledTexturesPerShaderStage_7fe798e58a892ea4 =
    function (arg0) {
      const ret = arg0.maxSampledTexturesPerShaderStage;
      return ret;
    };
  imports.wbg.__wbg_maxSamplersPerShaderStage_84408cd7914be213 = function (
    arg0
  ) {
    const ret = arg0.maxSamplersPerShaderStage;
    return ret;
  };
  imports.wbg.__wbg_maxStorageBufferBindingSize_9711b12549c371a6 = function (
    arg0
  ) {
    const ret = arg0.maxStorageBufferBindingSize;
    return ret;
  };
  imports.wbg.__wbg_maxStorageBuffersPerShaderStage_3b626e8ff1584e0b =
    function (arg0) {
      const ret = arg0.maxStorageBuffersPerShaderStage;
      return ret;
    };
  imports.wbg.__wbg_maxStorageTexturesPerShaderStage_c612c8e8f36e7ad3 =
    function (arg0) {
      const ret = arg0.maxStorageTexturesPerShaderStage;
      return ret;
    };
  imports.wbg.__wbg_maxTextureArrayLayers_6e0973f615982bee = function (arg0) {
    const ret = arg0.maxTextureArrayLayers;
    return ret;
  };
  imports.wbg.__wbg_maxTextureDimension1D_fda090a895ffead5 = function (arg0) {
    const ret = arg0.maxTextureDimension1D;
    return ret;
  };
  imports.wbg.__wbg_maxTextureDimension2D_876dc9c39fa8de4e = function (arg0) {
    const ret = arg0.maxTextureDimension2D;
    return ret;
  };
  imports.wbg.__wbg_maxTextureDimension3D_3e8ca51b995bc0e0 = function (arg0) {
    const ret = arg0.maxTextureDimension3D;
    return ret;
  };
  imports.wbg.__wbg_maxUniformBufferBindingSize_d9898f62e702922b = function (
    arg0
  ) {
    const ret = arg0.maxUniformBufferBindingSize;
    return ret;
  };
  imports.wbg.__wbg_maxUniformBuffersPerShaderStage_80346a93791c45ff =
    function (arg0) {
      const ret = arg0.maxUniformBuffersPerShaderStage;
      return ret;
    };
  imports.wbg.__wbg_maxVertexAttributes_bb30494dbeda4a16 = function (arg0) {
    const ret = arg0.maxVertexAttributes;
    return ret;
  };
  imports.wbg.__wbg_maxVertexBufferArrayStride_f2b103ca29d68d1a = function (
    arg0
  ) {
    const ret = arg0.maxVertexBufferArrayStride;
    return ret;
  };
  imports.wbg.__wbg_maxVertexBuffers_522f56407d841954 = function (arg0) {
    const ret = arg0.maxVertexBuffers;
    return ret;
  };
  imports.wbg.__wbg_minStorageBufferOffsetAlignment_8150d07a1d4bf231 =
    function (arg0) {
      const ret = arg0.minStorageBufferOffsetAlignment;
      return ret;
    };
  imports.wbg.__wbg_minUniformBufferOffsetAlignment_f2960fb3c8ad86bd =
    function (arg0) {
      const ret = arg0.minUniformBufferOffsetAlignment;
      return ret;
    };
  imports.wbg.__wbg_navigator_971384882e8ea23a = function (arg0) {
    const ret = arg0.navigator;
    return ret;
  };
  imports.wbg.__wbg_navigator_ae06f1666ea7c968 = function (arg0) {
    const ret = arg0.navigator;
    return ret;
  };
  imports.wbg.__wbg_new_1acc0b6eea89d040 = function () {
    const ret = new Object();
    return ret;
  };
  imports.wbg.__wbg_new_3c3d849046688a66 = function (arg0, arg1) {
    try {
      var state0 = { a: arg0, b: arg1 };
      var cb0 = (arg0, arg1) => {
        const a = state0.a;
        state0.a = 0;
        try {
          return wasm_bindgen__convert__closures_____invoke__h2a0f84921f614cc0(
            a,
            state0.b,
            arg0,
            arg1
          );
        } finally {
          state0.a = a;
        }
      };
      const ret = new Promise(cb0);
      return ret;
    } finally {
      state0.a = state0.b = 0;
    }
  };
  imports.wbg.__wbg_new_8a6f238a6ece86ea = function () {
    const ret = new Error();
    return ret;
  };
  imports.wbg.__wbg_new_e17d9f43105b08be = function () {
    const ret = new Array();
    return ret;
  };
  imports.wbg.__wbg_new_from_slice_92f4d78ca282a2d2 = function (arg0, arg1) {
    const ret = new Uint8Array(getArrayU8FromWasm0(arg0, arg1));
    return ret;
  };
  imports.wbg.__wbg_new_no_args_ee98eee5275000a4 = function (arg0, arg1) {
    const ret = new Function(getStringFromWasm0(arg0, arg1));
    return ret;
  };
  imports.wbg.__wbg_prototypesetcall_2a6620b6922694b2 = function (
    arg0,
    arg1,
    arg2
  ) {
    Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
  };
  imports.wbg.__wbg_push_df81a39d04db858c = function (arg0, arg1) {
    const ret = arg0.push(arg1);
    return ret;
  };
  imports.wbg.__wbg_querySelectorAll_e1a6c50956fdb6a2 = function () {
    return handleError(function (arg0, arg1, arg2) {
      const ret = arg0.querySelectorAll(getStringFromWasm0(arg1, arg2));
      return ret;
    }, arguments);
  };
  imports.wbg.__wbg_queueMicrotask_34d692c25c47d05b = function (arg0) {
    const ret = arg0.queueMicrotask;
    return ret;
  };
  imports.wbg.__wbg_queueMicrotask_9d76cacb20c84d58 = function (arg0) {
    queueMicrotask(arg0);
  };
  imports.wbg.__wbg_queue_39d4f3bda761adef = function (arg0) {
    const ret = arg0.queue;
    return ret;
  };
  imports.wbg.__wbg_rendererhandle_new = function (arg0) {
    const ret = RendererHandle.__wrap(arg0);
    return ret;
  };
  imports.wbg.__wbg_requestAdapter_55d15e6d14e8392c = function (arg0, arg1) {
    const ret = arg0.requestAdapter(arg1);
    return ret;
  };
  imports.wbg.__wbg_requestDevice_66e864eaf1ffbb38 = function (arg0, arg1) {
    const ret = arg0.requestDevice(arg1);
    return ret;
  };
  imports.wbg.__wbg_resolve_caf97c30b83f7053 = function (arg0) {
    const ret = Promise.resolve(arg0);
    return ret;
  };
  imports.wbg.__wbg_setBindGroup_250647fe6341e1db = function () {
    return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
      arg0.setBindGroup(
        arg1 >>> 0,
        arg2,
        getArrayU32FromWasm0(arg3, arg4),
        arg5,
        arg6 >>> 0
      );
    }, arguments);
  };
  imports.wbg.__wbg_setBindGroup_77fc1c2c49ddcff0 = function (
    arg0,
    arg1,
    arg2
  ) {
    arg0.setBindGroup(arg1 >>> 0, arg2);
  };
  imports.wbg.__wbg_setBindGroup_92f5fbfaea0311a0 = function (
    arg0,
    arg1,
    arg2
  ) {
    arg0.setBindGroup(arg1 >>> 0, arg2);
  };
  imports.wbg.__wbg_setBindGroup_b966448206045bdd = function () {
    return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
      arg0.setBindGroup(
        arg1 >>> 0,
        arg2,
        getArrayU32FromWasm0(arg3, arg4),
        arg5,
        arg6 >>> 0
      );
    }, arguments);
  };
  imports.wbg.__wbg_setPipeline_6dd7dffa6e7d7496 = function (arg0, arg1) {
    arg0.setPipeline(arg1);
  };
  imports.wbg.__wbg_setPipeline_95448e1c3bb1e875 = function (arg0, arg1) {
    arg0.setPipeline(arg1);
  };
  imports.wbg.__wbg_set_a_add312ccdfbfaa2d = function (arg0, arg1) {
    arg0.a = arg1;
  };
  imports.wbg.__wbg_set_access_c87a9bdb5c449e6b = function (arg0, arg1) {
    arg0.access = __wbindgen_enum_GpuStorageTextureAccess[arg1];
  };
  imports.wbg.__wbg_set_address_mode_u_2ff1a762cca3e679 = function (
    arg0,
    arg1
  ) {
    arg0.addressModeU = __wbindgen_enum_GpuAddressMode[arg1];
  };
  imports.wbg.__wbg_set_address_mode_v_1322b1b0dafa29ef = function (
    arg0,
    arg1
  ) {
    arg0.addressModeV = __wbindgen_enum_GpuAddressMode[arg1];
  };
  imports.wbg.__wbg_set_address_mode_w_1128071f5dcb4e54 = function (
    arg0,
    arg1
  ) {
    arg0.addressModeW = __wbindgen_enum_GpuAddressMode[arg1];
  };
  imports.wbg.__wbg_set_alpha_23751af59d391d98 = function (arg0, arg1) {
    arg0.alpha = arg1;
  };
  imports.wbg.__wbg_set_alpha_mode_1192a40e9bd8c3aa = function (arg0, arg1) {
    arg0.alphaMode = __wbindgen_enum_GpuCanvasAlphaMode[arg1];
  };
  imports.wbg.__wbg_set_alpha_to_coverage_enabled_9700e84c77d52727 = function (
    arg0,
    arg1
  ) {
    arg0.alphaToCoverageEnabled = arg1 !== 0;
  };
  imports.wbg.__wbg_set_array_layer_count_3a8ad1adab3aded1 = function (
    arg0,
    arg1
  ) {
    arg0.arrayLayerCount = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_array_stride_5508d074b809d568 = function (arg0, arg1) {
    arg0.arrayStride = arg1;
  };
  imports.wbg.__wbg_set_aspect_4066a62e6528c589 = function (arg0, arg1) {
    arg0.aspect = __wbindgen_enum_GpuTextureAspect[arg1];
  };
  imports.wbg.__wbg_set_attributes_aa15086089274167 = function (arg0, arg1) {
    arg0.attributes = arg1;
  };
  imports.wbg.__wbg_set_b_162f487856c3bad9 = function (arg0, arg1) {
    arg0.b = arg1;
  };
  imports.wbg.__wbg_set_base_array_layer_85c4780859e3e025 = function (
    arg0,
    arg1
  ) {
    arg0.baseArrayLayer = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_base_mip_level_f90525112a282a1d = function (
    arg0,
    arg1
  ) {
    arg0.baseMipLevel = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_beginning_of_pass_write_index_1175eec9e005d722 =
    function (arg0, arg1) {
      arg0.beginningOfPassWriteIndex = arg1 >>> 0;
    };
  imports.wbg.__wbg_set_beginning_of_pass_write_index_c8a62bc66645f5cd =
    function (arg0, arg1) {
      arg0.beginningOfPassWriteIndex = arg1 >>> 0;
    };
  imports.wbg.__wbg_set_bind_group_layouts_54f980eb55071c87 = function (
    arg0,
    arg1
  ) {
    arg0.bindGroupLayouts = arg1;
  };
  imports.wbg.__wbg_set_binding_1ddbf5eebabdc48c = function (arg0, arg1) {
    arg0.binding = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_binding_5ea4d52c77434dfa = function (arg0, arg1) {
    arg0.binding = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_blend_4a45a53ea0e4706e = function (arg0, arg1) {
    arg0.blend = arg1;
  };
  imports.wbg.__wbg_set_buffer_2dac3e64a7099038 = function (arg0, arg1) {
    arg0.buffer = arg1;
  };
  imports.wbg.__wbg_set_buffer_489d923366e1f63a = function (arg0, arg1) {
    arg0.buffer = arg1;
  };
  imports.wbg.__wbg_set_buffers_d5f54ba1d3368c00 = function (arg0, arg1) {
    arg0.buffers = arg1;
  };
  imports.wbg.__wbg_set_bytes_per_row_7eb4ea50ad336975 = function (arg0, arg1) {
    arg0.bytesPerRow = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_c2abbebe8b9ebee1 = function () {
    return handleError(function (arg0, arg1, arg2) {
      const ret = Reflect.set(arg0, arg1, arg2);
      return ret;
    }, arguments);
  };
  imports.wbg.__wbg_set_clear_value_1d26e1b07873908a = function (arg0, arg1) {
    arg0.clearValue = arg1;
  };
  imports.wbg.__wbg_set_code_e66de35c80aa100f = function (arg0, arg1, arg2) {
    arg0.code = getStringFromWasm0(arg1, arg2);
  };
  imports.wbg.__wbg_set_color_8d4bfc735001f4bd = function (arg0, arg1) {
    arg0.color = arg1;
  };
  imports.wbg.__wbg_set_color_attachments_6118b962baa6088d = function (
    arg0,
    arg1
  ) {
    arg0.colorAttachments = arg1;
  };
  imports.wbg.__wbg_set_compare_019e85bf2bf22bc8 = function (arg0, arg1) {
    arg0.compare = __wbindgen_enum_GpuCompareFunction[arg1];
  };
  imports.wbg.__wbg_set_compare_3a69aad67f43501e = function (arg0, arg1) {
    arg0.compare = __wbindgen_enum_GpuCompareFunction[arg1];
  };
  imports.wbg.__wbg_set_compute_7e84d836a17ec8dc = function (arg0, arg1) {
    arg0.compute = arg1;
  };
  imports.wbg.__wbg_set_count_2013aa835878f321 = function (arg0, arg1) {
    arg0.count = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_cull_mode_e82736bddd8d5a5c = function (arg0, arg1) {
    arg0.cullMode = __wbindgen_enum_GpuCullMode[arg1];
  };
  imports.wbg.__wbg_set_depth_bias_clamp_30724e55c04b7132 = function (
    arg0,
    arg1
  ) {
    arg0.depthBiasClamp = arg1;
  };
  imports.wbg.__wbg_set_depth_bias_dc092ae40ce06777 = function (arg0, arg1) {
    arg0.depthBias = arg1;
  };
  imports.wbg.__wbg_set_depth_bias_slope_scale_3047f42a19dd1d21 = function (
    arg0,
    arg1
  ) {
    arg0.depthBiasSlopeScale = arg1;
  };
  imports.wbg.__wbg_set_depth_clear_value_e09b29c35f439d38 = function (
    arg0,
    arg1
  ) {
    arg0.depthClearValue = arg1;
  };
  imports.wbg.__wbg_set_depth_compare_7ff390bcd4cbc798 = function (arg0, arg1) {
    arg0.depthCompare = __wbindgen_enum_GpuCompareFunction[arg1];
  };
  imports.wbg.__wbg_set_depth_fail_op_32e5a25f8472872a = function (arg0, arg1) {
    arg0.depthFailOp = __wbindgen_enum_GpuStencilOperation[arg1];
  };
  imports.wbg.__wbg_set_depth_load_op_5292e3e4542c7770 = function (arg0, arg1) {
    arg0.depthLoadOp = __wbindgen_enum_GpuLoadOp[arg1];
  };
  imports.wbg.__wbg_set_depth_or_array_layers_57e35a31ded46b97 = function (
    arg0,
    arg1
  ) {
    arg0.depthOrArrayLayers = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_depth_read_only_8e4aa6065b3f0cb1 = function (
    arg0,
    arg1
  ) {
    arg0.depthReadOnly = arg1 !== 0;
  };
  imports.wbg.__wbg_set_depth_stencil_2708265354655cab = function (arg0, arg1) {
    arg0.depthStencil = arg1;
  };
  imports.wbg.__wbg_set_depth_stencil_attachment_ef75a68ffe787e5a = function (
    arg0,
    arg1
  ) {
    arg0.depthStencilAttachment = arg1;
  };
  imports.wbg.__wbg_set_depth_store_op_a7eddf1211b8cf40 = function (
    arg0,
    arg1
  ) {
    arg0.depthStoreOp = __wbindgen_enum_GpuStoreOp[arg1];
  };
  imports.wbg.__wbg_set_depth_write_enabled_acc3c3e7425182f8 = function (
    arg0,
    arg1
  ) {
    arg0.depthWriteEnabled = arg1 !== 0;
  };
  imports.wbg.__wbg_set_device_44b06c4615b5e253 = function (arg0, arg1) {
    arg0.device = arg1;
  };
  imports.wbg.__wbg_set_dimension_1e40af745768ac00 = function (arg0, arg1) {
    arg0.dimension = __wbindgen_enum_GpuTextureDimension[arg1];
  };
  imports.wbg.__wbg_set_dimension_8523a7df804e7839 = function (arg0, arg1) {
    arg0.dimension = __wbindgen_enum_GpuTextureViewDimension[arg1];
  };
  imports.wbg.__wbg_set_dst_factor_f1f99957519ecc26 = function (arg0, arg1) {
    arg0.dstFactor = __wbindgen_enum_GpuBlendFactor[arg1];
  };
  imports.wbg.__wbg_set_end_of_pass_write_index_7e0b2037985d92b3 = function (
    arg0,
    arg1
  ) {
    arg0.endOfPassWriteIndex = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_end_of_pass_write_index_c9e77fba223f5e64 = function (
    arg0,
    arg1
  ) {
    arg0.endOfPassWriteIndex = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_entries_5ebe60dce5e74a0b = function (arg0, arg1) {
    arg0.entries = arg1;
  };
  imports.wbg.__wbg_set_entries_9e330e1730f04662 = function (arg0, arg1) {
    arg0.entries = arg1;
  };
  imports.wbg.__wbg_set_entry_point_0a1a32e09949ab1d = function (
    arg0,
    arg1,
    arg2
  ) {
    arg0.entryPoint = getStringFromWasm0(arg1, arg2);
  };
  imports.wbg.__wbg_set_entry_point_0dd252068a92e7b1 = function (
    arg0,
    arg1,
    arg2
  ) {
    arg0.entryPoint = getStringFromWasm0(arg1, arg2);
  };
  imports.wbg.__wbg_set_entry_point_f8a6dd312fc366f9 = function (
    arg0,
    arg1,
    arg2
  ) {
    arg0.entryPoint = getStringFromWasm0(arg1, arg2);
  };
  imports.wbg.__wbg_set_external_texture_c45a65eda8f1c7e7 = function (
    arg0,
    arg1
  ) {
    arg0.externalTexture = arg1;
  };
  imports.wbg.__wbg_set_fail_op_30e3f1483250eade = function (arg0, arg1) {
    arg0.failOp = __wbindgen_enum_GpuStencilOperation[arg1];
  };
  imports.wbg.__wbg_set_format_071b082598e71ae2 = function (arg0, arg1) {
    arg0.format = __wbindgen_enum_GpuTextureFormat[arg1];
  };
  imports.wbg.__wbg_set_format_2a57c4eddb717f46 = function (arg0, arg1) {
    arg0.format = __wbindgen_enum_GpuVertexFormat[arg1];
  };
  imports.wbg.__wbg_set_format_45c59d08eefdcb12 = function (arg0, arg1) {
    arg0.format = __wbindgen_enum_GpuTextureFormat[arg1];
  };
  imports.wbg.__wbg_set_format_71f884d31aabe541 = function (arg0, arg1) {
    arg0.format = __wbindgen_enum_GpuTextureFormat[arg1];
  };
  imports.wbg.__wbg_set_format_726ed8f81a287fdc = function (arg0, arg1) {
    arg0.format = __wbindgen_enum_GpuTextureFormat[arg1];
  };
  imports.wbg.__wbg_set_format_8530b9d25ea51775 = function (arg0, arg1) {
    arg0.format = __wbindgen_enum_GpuTextureFormat[arg1];
  };
  imports.wbg.__wbg_set_format_d5c08abcb3a02a26 = function (arg0, arg1) {
    arg0.format = __wbindgen_enum_GpuTextureFormat[arg1];
  };
  imports.wbg.__wbg_set_fragment_a6d6aa2f648896c5 = function (arg0, arg1) {
    arg0.fragment = arg1;
  };
  imports.wbg.__wbg_set_front_face_fccdd9171df26b56 = function (arg0, arg1) {
    arg0.frontFace = __wbindgen_enum_GpuFrontFace[arg1];
  };
  imports.wbg.__wbg_set_g_d7b95d11c12af1cb = function (arg0, arg1) {
    arg0.g = arg1;
  };
  imports.wbg.__wbg_set_has_dynamic_offset_dcbae080558be467 = function (
    arg0,
    arg1
  ) {
    arg0.hasDynamicOffset = arg1 !== 0;
  };
  imports.wbg.__wbg_set_height_05e78c661a8e6366 = function (arg0, arg1) {
    arg0.height = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_height_28e79506f626af82 = function (arg0, arg1) {
    arg0.height = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_height_89110f48f7fd0817 = function (arg0, arg1) {
    arg0.height = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_label_03ef288b104476b5 = function (arg0, arg1, arg2) {
    arg0.label = getStringFromWasm0(arg1, arg2);
  };
  imports.wbg.__wbg_set_label_1183ccaccddf4c32 = function (arg0, arg1, arg2) {
    arg0.label = getStringFromWasm0(arg1, arg2);
  };
  imports.wbg.__wbg_set_label_3d8a20f328073061 = function (arg0, arg1, arg2) {
    arg0.label = getStringFromWasm0(arg1, arg2);
  };
  imports.wbg.__wbg_set_label_491466139034563c = function (arg0, arg1, arg2) {
    arg0.label = getStringFromWasm0(arg1, arg2);
  };
  imports.wbg.__wbg_set_label_53b47ffdebccf638 = function (arg0, arg1, arg2) {
    arg0.label = getStringFromWasm0(arg1, arg2);
  };
  imports.wbg.__wbg_set_label_6d317656a2b3dea6 = function (arg0, arg1, arg2) {
    arg0.label = getStringFromWasm0(arg1, arg2);
  };
  imports.wbg.__wbg_set_label_7ffda3ed69c72b85 = function (arg0, arg1, arg2) {
    arg0.label = getStringFromWasm0(arg1, arg2);
  };
  imports.wbg.__wbg_set_label_828e6fe16c83ad61 = function (arg0, arg1, arg2) {
    arg0.label = getStringFromWasm0(arg1, arg2);
  };
  imports.wbg.__wbg_set_label_95bae3d54f33d3c6 = function (arg0, arg1, arg2) {
    arg0.label = getStringFromWasm0(arg1, arg2);
  };
  imports.wbg.__wbg_set_label_a1c8caea9f6c17d7 = function (arg0, arg1, arg2) {
    arg0.label = getStringFromWasm0(arg1, arg2);
  };
  imports.wbg.__wbg_set_label_a3e682ef8c10c947 = function (arg0, arg1, arg2) {
    arg0.label = getStringFromWasm0(arg1, arg2);
  };
  imports.wbg.__wbg_set_label_c7426807cb0ab0d7 = function (arg0, arg1, arg2) {
    arg0.label = getStringFromWasm0(arg1, arg2);
  };
  imports.wbg.__wbg_set_label_c880c612e67bf9d9 = function (arg0, arg1, arg2) {
    arg0.label = getStringFromWasm0(arg1, arg2);
  };
  imports.wbg.__wbg_set_label_d5ff85faa53a8c67 = function (arg0, arg1, arg2) {
    arg0.label = getStringFromWasm0(arg1, arg2);
  };
  imports.wbg.__wbg_set_label_eb73d9dd282c005a = function (arg0, arg1, arg2) {
    arg0.label = getStringFromWasm0(arg1, arg2);
  };
  imports.wbg.__wbg_set_layout_38ee34b009072f0c = function (arg0, arg1) {
    arg0.layout = arg1;
  };
  imports.wbg.__wbg_set_layout_934f9127172b906e = function (arg0, arg1) {
    arg0.layout = arg1;
  };
  imports.wbg.__wbg_set_layout_a9aebce493b15bfb = function (arg0, arg1) {
    arg0.layout = arg1;
  };
  imports.wbg.__wbg_set_load_op_15883d29f266b084 = function (arg0, arg1) {
    arg0.loadOp = __wbindgen_enum_GpuLoadOp[arg1];
  };
  imports.wbg.__wbg_set_lod_max_clamp_f1429df82c4b3ea8 = function (arg0, arg1) {
    arg0.lodMaxClamp = arg1;
  };
  imports.wbg.__wbg_set_lod_min_clamp_9609dff5684c3fe5 = function (arg0, arg1) {
    arg0.lodMinClamp = arg1;
  };
  imports.wbg.__wbg_set_mag_filter_b97a014d5bdb96e4 = function (arg0, arg1) {
    arg0.magFilter = __wbindgen_enum_GpuFilterMode[arg1];
  };
  imports.wbg.__wbg_set_mapped_at_creation_37dd8bbd1a910924 = function (
    arg0,
    arg1
  ) {
    arg0.mappedAtCreation = arg1 !== 0;
  };
  imports.wbg.__wbg_set_mask_60410c7f40b0fe24 = function (arg0, arg1) {
    arg0.mask = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_max_anisotropy_cae2737696b22ee1 = function (
    arg0,
    arg1
  ) {
    arg0.maxAnisotropy = arg1;
  };
  imports.wbg.__wbg_set_min_binding_size_f7d3351b78c71fbc = function (
    arg0,
    arg1
  ) {
    arg0.minBindingSize = arg1;
  };
  imports.wbg.__wbg_set_min_filter_386c520cd285c6b2 = function (arg0, arg1) {
    arg0.minFilter = __wbindgen_enum_GpuFilterMode[arg1];
  };
  imports.wbg.__wbg_set_mip_level_4adfe9f0872d052d = function (arg0, arg1) {
    arg0.mipLevel = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_mip_level_count_3368440f1c3c34b9 = function (
    arg0,
    arg1
  ) {
    arg0.mipLevelCount = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_mip_level_count_9de96fe0db85420d = function (
    arg0,
    arg1
  ) {
    arg0.mipLevelCount = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_mipmap_filter_ba0ff5e3e86bc573 = function (arg0, arg1) {
    arg0.mipmapFilter = __wbindgen_enum_GpuMipmapFilterMode[arg1];
  };
  imports.wbg.__wbg_set_module_0700e7e0b7b4f128 = function (arg0, arg1) {
    arg0.module = arg1;
  };
  imports.wbg.__wbg_set_module_4a8baf88303e8712 = function (arg0, arg1) {
    arg0.module = arg1;
  };
  imports.wbg.__wbg_set_module_871baa111fc4d61b = function (arg0, arg1) {
    arg0.module = arg1;
  };
  imports.wbg.__wbg_set_multisample_d07e1d64727f8cc6 = function (arg0, arg1) {
    arg0.multisample = arg1;
  };
  imports.wbg.__wbg_set_multisampled_dc1cdd807d0170e1 = function (arg0, arg1) {
    arg0.multisampled = arg1 !== 0;
  };
  imports.wbg.__wbg_set_offset_51eb43b37f1e9525 = function (arg0, arg1) {
    arg0.offset = arg1;
  };
  imports.wbg.__wbg_set_offset_a0d9f31cd1585a78 = function (arg0, arg1) {
    arg0.offset = arg1;
  };
  imports.wbg.__wbg_set_offset_a90a41961b1df9b4 = function (arg0, arg1) {
    arg0.offset = arg1;
  };
  imports.wbg.__wbg_set_operation_2bbceba9621b7980 = function (arg0, arg1) {
    arg0.operation = __wbindgen_enum_GpuBlendOperation[arg1];
  };
  imports.wbg.__wbg_set_origin_154a83d3703121d7 = function (arg0, arg1) {
    arg0.origin = arg1;
  };
  imports.wbg.__wbg_set_pass_op_57a439a73e0295e2 = function (arg0, arg1) {
    arg0.passOp = __wbindgen_enum_GpuStencilOperation[arg1];
  };
  imports.wbg.__wbg_set_power_preference_229fffedb859fda8 = function (
    arg0,
    arg1
  ) {
    arg0.powerPreference = __wbindgen_enum_GpuPowerPreference[arg1];
  };
  imports.wbg.__wbg_set_primitive_6c50407f92440018 = function (arg0, arg1) {
    arg0.primitive = arg1;
  };
  imports.wbg.__wbg_set_query_set_1f0efa5a49a1b2ad = function (arg0, arg1) {
    arg0.querySet = arg1;
  };
  imports.wbg.__wbg_set_query_set_5d767886356c7b79 = function (arg0, arg1) {
    arg0.querySet = arg1;
  };
  imports.wbg.__wbg_set_r_6ad5c6f67a5f5a57 = function (arg0, arg1) {
    arg0.r = arg1;
  };
  imports.wbg.__wbg_set_required_features_8135f6ab89e06b58 = function (
    arg0,
    arg1
  ) {
    arg0.requiredFeatures = arg1;
  };
  imports.wbg.__wbg_set_resolve_target_95ee5e55e47822ff = function (
    arg0,
    arg1
  ) {
    arg0.resolveTarget = arg1;
  };
  imports.wbg.__wbg_set_resource_97233a9ead07e4bc = function (arg0, arg1) {
    arg0.resource = arg1;
  };
  imports.wbg.__wbg_set_rows_per_image_b2e56467282d270a = function (
    arg0,
    arg1
  ) {
    arg0.rowsPerImage = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_sample_count_df26d31cf04a57d8 = function (arg0, arg1) {
    arg0.sampleCount = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_sample_type_5671a405c6474494 = function (arg0, arg1) {
    arg0.sampleType = __wbindgen_enum_GpuTextureSampleType[arg1];
  };
  imports.wbg.__wbg_set_sampler_43a3dd77c3b0a5ba = function (arg0, arg1) {
    arg0.sampler = arg1;
  };
  imports.wbg.__wbg_set_shader_location_99975e71b887d57f = function (
    arg0,
    arg1
  ) {
    arg0.shaderLocation = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_size_1a3d1e3a2e547ec1 = function (arg0, arg1) {
    arg0.size = arg1;
  };
  imports.wbg.__wbg_set_size_a45dd219534f95ed = function (arg0, arg1) {
    arg0.size = arg1;
  };
  imports.wbg.__wbg_set_size_e0576eacd9f11fed = function (arg0, arg1) {
    arg0.size = arg1;
  };
  imports.wbg.__wbg_set_src_factor_368c2472010737bf = function (arg0, arg1) {
    arg0.srcFactor = __wbindgen_enum_GpuBlendFactor[arg1];
  };
  imports.wbg.__wbg_set_stencil_back_c70185d4a7d8b41f = function (arg0, arg1) {
    arg0.stencilBack = arg1;
  };
  imports.wbg.__wbg_set_stencil_clear_value_1580738072a672c0 = function (
    arg0,
    arg1
  ) {
    arg0.stencilClearValue = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_stencil_front_dc4230c3548ea7f6 = function (arg0, arg1) {
    arg0.stencilFront = arg1;
  };
  imports.wbg.__wbg_set_stencil_load_op_8486231257ee81bf = function (
    arg0,
    arg1
  ) {
    arg0.stencilLoadOp = __wbindgen_enum_GpuLoadOp[arg1];
  };
  imports.wbg.__wbg_set_stencil_read_mask_027558153bfc424b = function (
    arg0,
    arg1
  ) {
    arg0.stencilReadMask = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_stencil_read_only_3f415ad876ffa592 = function (
    arg0,
    arg1
  ) {
    arg0.stencilReadOnly = arg1 !== 0;
  };
  imports.wbg.__wbg_set_stencil_store_op_39fcdf3cc001e427 = function (
    arg0,
    arg1
  ) {
    arg0.stencilStoreOp = __wbindgen_enum_GpuStoreOp[arg1];
  };
  imports.wbg.__wbg_set_stencil_write_mask_6018d5b786f024b1 = function (
    arg0,
    arg1
  ) {
    arg0.stencilWriteMask = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_step_mode_3b73fd4c54248ad9 = function (arg0, arg1) {
    arg0.stepMode = __wbindgen_enum_GpuVertexStepMode[arg1];
  };
  imports.wbg.__wbg_set_storage_texture_4853479f6eb61a57 = function (
    arg0,
    arg1
  ) {
    arg0.storageTexture = arg1;
  };
  imports.wbg.__wbg_set_store_op_0e46dbc6c9712fbb = function (arg0, arg1) {
    arg0.storeOp = __wbindgen_enum_GpuStoreOp[arg1];
  };
  imports.wbg.__wbg_set_strip_index_format_be4689e628d10d25 = function (
    arg0,
    arg1
  ) {
    arg0.stripIndexFormat = __wbindgen_enum_GpuIndexFormat[arg1];
  };
  imports.wbg.__wbg_set_targets_c52d21117ec2cbc0 = function (arg0, arg1) {
    arg0.targets = arg1;
  };
  imports.wbg.__wbg_set_texture_5f219a723eb7db43 = function (arg0, arg1) {
    arg0.texture = arg1;
  };
  imports.wbg.__wbg_set_texture_84c4ac5434a9ddb5 = function (arg0, arg1) {
    arg0.texture = arg1;
  };
  imports.wbg.__wbg_set_timestamp_writes_9c3e9dd8a3e800a1 = function (
    arg0,
    arg1
  ) {
    arg0.timestampWrites = arg1;
  };
  imports.wbg.__wbg_set_timestamp_writes_db44391e390948e2 = function (
    arg0,
    arg1
  ) {
    arg0.timestampWrites = arg1;
  };
  imports.wbg.__wbg_set_topology_0c9fa83132042031 = function (arg0, arg1) {
    arg0.topology = __wbindgen_enum_GpuPrimitiveTopology[arg1];
  };
  imports.wbg.__wbg_set_type_0a9fcee42b714ba8 = function (arg0, arg1) {
    arg0.type = __wbindgen_enum_GpuBufferBindingType[arg1];
  };
  imports.wbg.__wbg_set_type_ba111b7f1813a222 = function (arg0, arg1) {
    arg0.type = __wbindgen_enum_GpuSamplerBindingType[arg1];
  };
  imports.wbg.__wbg_set_unclipped_depth_b8bfc6ba4e566a5f = function (
    arg0,
    arg1
  ) {
    arg0.unclippedDepth = arg1 !== 0;
  };
  imports.wbg.__wbg_set_usage_0f3970011718ab12 = function (arg0, arg1) {
    arg0.usage = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_usage_49bed7c9b47e7849 = function (arg0, arg1) {
    arg0.usage = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_usage_7ffa4257ea250d02 = function (arg0, arg1) {
    arg0.usage = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_usage_8a5ac4564d826d9d = function (arg0, arg1) {
    arg0.usage = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_vertex_725cd211418aeffb = function (arg0, arg1) {
    arg0.vertex = arg1;
  };
  imports.wbg.__wbg_set_view_2ae2d88e6d071b88 = function (arg0, arg1) {
    arg0.view = arg1;
  };
  imports.wbg.__wbg_set_view_5db167adcc0d1b9c = function (arg0, arg1) {
    arg0.view = arg1;
  };
  imports.wbg.__wbg_set_view_dimension_2e3a58d96671f97a = function (
    arg0,
    arg1
  ) {
    arg0.viewDimension = __wbindgen_enum_GpuTextureViewDimension[arg1];
  };
  imports.wbg.__wbg_set_view_dimension_88c1a47ce71f7839 = function (
    arg0,
    arg1
  ) {
    arg0.viewDimension = __wbindgen_enum_GpuTextureViewDimension[arg1];
  };
  imports.wbg.__wbg_set_view_formats_dbd4d0d50ed403ff = function (arg0, arg1) {
    arg0.viewFormats = arg1;
  };
  imports.wbg.__wbg_set_view_formats_e21a9630b45aff68 = function (arg0, arg1) {
    arg0.viewFormats = arg1;
  };
  imports.wbg.__wbg_set_visibility_f4f66940005e5c39 = function (arg0, arg1) {
    arg0.visibility = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_width_39f67bbfbb9437ba = function (arg0, arg1) {
    arg0.width = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_width_64c5783b064042bc = function (arg0, arg1) {
    arg0.width = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_width_dcc02c61dd01cff6 = function (arg0, arg1) {
    arg0.width = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_write_mask_4198f874c5422156 = function (arg0, arg1) {
    arg0.writeMask = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_x_d5236bf9391eb053 = function (arg0, arg1) {
    arg0.x = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_y_413262ade3cc0d56 = function (arg0, arg1) {
    arg0.y = arg1 >>> 0;
  };
  imports.wbg.__wbg_set_z_a136ba9bd16085f0 = function (arg0, arg1) {
    arg0.z = arg1 >>> 0;
  };
  imports.wbg.__wbg_stack_0ed75d68575b0f3c = function (arg0, arg1) {
    const ret = arg1.stack;
    const ptr1 = passStringToWasm0(
      ret,
      wasm.__wbindgen_malloc,
      wasm.__wbindgen_realloc
    );
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
  };
  imports.wbg.__wbg_static_accessor_GLOBAL_89e1d9ac6a1b250e = function () {
    const ret = typeof global === "undefined" ? null : global;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
  };
  imports.wbg.__wbg_static_accessor_GLOBAL_THIS_8b530f326a9e48ac = function () {
    const ret = typeof globalThis === "undefined" ? null : globalThis;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
  };
  imports.wbg.__wbg_static_accessor_SELF_6fdf4b64710cc91b = function () {
    const ret = typeof self === "undefined" ? null : self;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
  };
  imports.wbg.__wbg_static_accessor_WINDOW_b45bfc5a37f6cfa2 = function () {
    const ret = typeof window === "undefined" ? null : window;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
  };
  imports.wbg.__wbg_submit_068b03683463d934 = function (arg0, arg1) {
    arg0.submit(arg1);
  };
  imports.wbg.__wbg_then_4f46f6544e6b4a28 = function (arg0, arg1) {
    const ret = arg0.then(arg1);
    return ret;
  };
  imports.wbg.__wbg_then_70d05cf780a18d77 = function (arg0, arg1, arg2) {
    const ret = arg0.then(arg1, arg2);
    return ret;
  };
  imports.wbg.__wbg_width_9ea2df52b5d2c909 = function (arg0) {
    const ret = arg0.width;
    return ret;
  };
  imports.wbg.__wbg_writeBuffer_b479dd5b90cd43eb = function () {
    return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5) {
      arg0.writeBuffer(arg1, arg2, arg3, arg4, arg5);
    }, arguments);
  };
  imports.wbg.__wbg_writeTexture_c70826cc2ae8e127 = function () {
    return handleError(function (arg0, arg1, arg2, arg3, arg4) {
      arg0.writeTexture(arg1, arg2, arg3, arg4);
    }, arguments);
  };
  imports.wbg.__wbindgen_cast_2241b6af4c4b2941 = function (arg0, arg1) {
    // Cast intrinsic for `Ref(String) -> Externref`.
    const ret = getStringFromWasm0(arg0, arg1);
    return ret;
  };
  imports.wbg.__wbindgen_cast_443332637da6f2f5 = function (arg0, arg1) {
    // Cast intrinsic for `Closure(Closure { dtor_idx: 160, function: Function { arguments: [Externref], shim_idx: 161, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
    const ret = makeMutClosure(
      arg0,
      arg1,
      wasm.wasm_bindgen__closure__destroy__hb8467f3e511a960c,
      wasm_bindgen__convert__closures_____invoke__h1e3f4f5e5b6e003f
    );
    return ret;
  };
  imports.wbg.__wbindgen_cast_d6cd19b81560fd6e = function (arg0) {
    // Cast intrinsic for `F64 -> Externref`.
    const ret = arg0;
    return ret;
  };
  imports.wbg.__wbindgen_init_externref_table = function () {
    const table = wasm.__wbindgen_externrefs;
    const offset = table.grow(4);
    table.set(0, undefined);
    table.set(offset + 0, undefined);
    table.set(offset + 1, null);
    table.set(offset + 2, true);
    table.set(offset + 3, false);
  };

  return imports;
}

function __wbg_finalize_init(instance, module) {
  wasm = instance.exports;
  __wbg_init.__wbindgen_wasm_module = module;
  cachedDataViewMemory0 = null;
  cachedUint32ArrayMemory0 = null;
  cachedUint8ArrayMemory0 = null;

  wasm.__wbindgen_start();
  return wasm;
}

function initSync(module) {
  if (wasm !== undefined) return wasm;

  if (typeof module !== "undefined") {
    if (Object.getPrototypeOf(module) === Object.prototype) {
      ({ module } = module);
    } else {
      console.warn(
        "using deprecated parameters for `initSync()`; pass a single object instead"
      );
    }
  }

  const imports = __wbg_get_imports();

  if (!(module instanceof WebAssembly.Module)) {
    module = new WebAssembly.Module(module);
  }

  const instance = new WebAssembly.Instance(module, imports);

  return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
  if (wasm !== undefined) return wasm;

  if (typeof module_or_path !== "undefined") {
    if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
      ({ module_or_path } = module_or_path);
    } else {
      console.warn(
        "using deprecated parameters for the initialization function; pass a single object instead"
      );
    }
  }

  if (typeof module_or_path === "undefined") {
    module_or_path = new URL("rvello_bg.wasm", import.meta.url);
  }
  const imports = __wbg_get_imports();

  if (
    typeof module_or_path === "string" ||
    (typeof Request === "function" && module_or_path instanceof Request) ||
    (typeof URL === "function" && module_or_path instanceof URL)
  ) {
    module_or_path = fetch(module_or_path);
  }

  const { instance, module } = await __wbg_load(await module_or_path, imports);

  return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
