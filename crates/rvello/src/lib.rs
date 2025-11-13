use js_sys::Uint8Array;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct RendererHandle {}

#[wasm_bindgen]
impl RendererHandle {
    #[wasm_bindgen(constructor)]
    pub fn new() -> RendererHandle {
        console_error_panic_hook::set_once();
        RendererHandle {}
    }

    #[wasm_bindgen]
    pub fn apply(&self, _ops: Uint8Array) {}

    #[wasm_bindgen]
    pub fn render(&self) {}
}

#[wasm_bindgen(start)]
pub fn wasm_start() {
    console_error_panic_hook::set_once();
}
