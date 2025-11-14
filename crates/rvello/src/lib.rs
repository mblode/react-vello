use js_sys::Uint8Array;
use wasm_bindgen::prelude::*;
use web_sys::HtmlCanvasElement;

use vello::kurbo::{Affine, BezPath, RoundedRect, Stroke};
use vello::peniko::{Color, Fill};
use vello::{wgpu, AaConfig, Renderer, RendererOptions, Scene};

#[wasm_bindgen]
pub struct RendererHandle {
    device: wgpu::Device,
    queue: wgpu::Queue,
    surface: wgpu::Surface<'static>,
    config: wgpu::SurfaceConfiguration,
    renderer: Renderer,
    scene: Scene,
    base_color: Color,
}

#[wasm_bindgen]
pub async fn create_renderer(_canvas: HtmlCanvasElement) -> Result<RendererHandle, JsValue> {
        console_error_panic_hook::set_once();

        // NOTE: Surface creation from HTMLCanvasElement is not directly supported in wgpu 26.0.1 on WASM
        // This requires either:
        // 1. Using winit for window management (adds dependency)
        // 2. Upgrading to wgpu 0.22 which had better WASM canvas support
        // 3. Using unsafe raw-window-handle traits with manual FFI
        //
        // For now, return an error indicating this is not yet implemented.
        // The TypeScript layer will fall back to Canvas2D rendering.
        Err(JsValue::from_str("WebGPU surface creation from canvas is not yet implemented. Use the Canvas2D fallback renderer."))
}

// TODO: Implement WebGPU surface creation when wgpu adds proper WASM canvas support
// or when using winit for window management

#[wasm_bindgen]
impl RendererHandle {
    #[wasm_bindgen]
    pub fn resize(&mut self, width: u32, height: u32) {
        if width == 0 || height == 0 {
            return;
        }
        if self.config.width == width && self.config.height == height {
            return;
        }
        self.config.width = width;
        self.config.height = height;
        self.surface.configure(&self.device, &self.config);
    }

    #[wasm_bindgen]
    pub fn apply(&mut self, ops: Uint8Array) -> Result<(), JsValue> {
        let bytes = ops.to_vec();
        let mut decoder = Decoder::new(&bytes);

        self.scene.reset();
        self.base_color = Color::new([0.0, 0.0, 0.0, 1.0]);

        while let Some(op) = decoder.next_opcode()? {
            match op {
                OpCode::BeginFrame => {
                    let logical_width = decoder.read_f32()?;
                    let logical_height = decoder.read_f32()?;
                    let dpr = decoder.read_f32()?;
                    let width = (logical_width * dpr).round().clamp(1.0, f32::MAX) as u32;
                    let height = (logical_height * dpr).round().clamp(1.0, f32::MAX) as u32;
                    self.resize(width, height);
                    let r = decoder.read_f32()?;
                    let g = decoder.read_f32()?;
                    let b = decoder.read_f32()?;
                    let a = decoder.read_f32()?;
                    self.base_color = Color::new([r, g, b, a]);
                }
                OpCode::Rect => {
                    let opacity = decoder.read_f32()?;
                    let transform = decoder.read_mat3()?;
                    let ox = decoder.read_f32()?;
                    let oy = decoder.read_f32()?;
                    let width = decoder.read_f32()?;
                    let height = decoder.read_f32()?;
                    let radius = decoder.read_f32()?;
                    let r = decoder.read_f32()?;
                    let g = decoder.read_f32()?;
                    let b = decoder.read_f32()?;
                    let a = decoder.read_f32()?;

                    let color = Color::new([r, g, b, (a * opacity).clamp(0.0, 1.0)]);
                    let rect = RoundedRect::new(
                        ox as f64,
                        oy as f64,
                        (ox + width) as f64,
                        (oy + height) as f64,
                        radius as f64,
                    );
                    let affine = Affine::new([
                        transform[0] as f64,
                        transform[1] as f64,
                        transform[2] as f64,
                        transform[3] as f64,
                        transform[4] as f64,
                        transform[5] as f64,
                    ]);

                    self.scene.fill(Fill::NonZero, affine, color, None, &rect);
                }
                OpCode::Path => {
                    let opacity = decoder.read_f32()?;
                    let transform = decoder.read_mat3()?;
                    let fill_rule = decoder.read_u8()?;

                    let affine = Affine::new([
                        transform[0] as f64,
                        transform[1] as f64,
                        transform[2] as f64,
                        transform[3] as f64,
                        transform[4] as f64,
                        transform[5] as f64,
                    ]);

                    // Read fill
                    let has_fill = decoder.read_u8()? != 0;
                    let fill_color = if has_fill {
                        let r = decoder.read_f32()?;
                        let g = decoder.read_f32()?;
                        let b = decoder.read_f32()?;
                        let a = decoder.read_f32()?;
                        Some(Color::new([r, g, b, (a * opacity).clamp(0.0, 1.0)]))
                    } else {
                        None
                    };

                    // Read stroke
                    let has_stroke = decoder.read_u8()? != 0;
                    let stroke_info = if has_stroke {
                        let width = decoder.read_f32()?;
                        let r = decoder.read_f32()?;
                        let g = decoder.read_f32()?;
                        let b = decoder.read_f32()?;
                        let a = decoder.read_f32()?;
                        Some((width, Color::new([r, g, b, (a * opacity).clamp(0.0, 1.0)])))
                    } else {
                        None
                    };

                    // Read path data
                    let path_len = decoder.read_u32()?;
                    let path_str = decoder.read_string(path_len as usize)?;

                    // Parse SVG path string
                    if let Ok(bez_path) = BezPath::from_svg(&path_str) {
                        let fill_style = if fill_rule == 1 {
                            Fill::EvenOdd
                        } else {
                            Fill::NonZero
                        };

                        if let Some(color) = fill_color {
                            self.scene.fill(fill_style, affine, color, None, &bez_path);
                        }

                        if let Some((width, color)) = stroke_info {
                            let stroke = Stroke::new(width as f64);
                            self.scene.stroke(&stroke, affine, color, None, &bez_path);
                        }
                    }
                }
                OpCode::EndFrame => break,
            }
        }

        Ok(())
    }

    #[wasm_bindgen]
    pub fn render(&mut self) -> Result<(), JsValue> {
        let frame = match self.surface.get_current_texture() {
            Ok(frame) => frame,
            Err(err) => {
                match err {
                    wgpu::SurfaceError::Lost => {
                        self.surface.configure(&self.device, &self.config);
                    }
                    wgpu::SurfaceError::Outdated => {
                        self.surface.configure(&self.device, &self.config);
                    }
                    wgpu::SurfaceError::OutOfMemory => {
                        return Err(JsValue::from_str("WebGPU surface out of memory"));
                    }
                    wgpu::SurfaceError::Timeout => {
                        return Ok(());
                    }
                    wgpu::SurfaceError::Other => {
                        return Err(JsValue::from_str("WebGPU surface error"));
                    }
                }
                self.surface
                    .get_current_texture()
                    .map_err(|e| JsValue::from_str(&format!("Failed to acquire surface: {e:?}")) )?
            }
        };

        let view = frame
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());
        let params = vello::RenderParams {
            base_color: self.base_color,
            width: self.config.width,
            height: self.config.height,
            antialiasing_method: AaConfig::Area,
        };

        self.renderer
            .render_to_texture(&self.device, &self.queue, &self.scene, &view, &params)
            .map_err(|err| JsValue::from_str(&format!("Render failed: {err:?}")))?;
        frame.present();
        Ok(())
    }
}

struct Decoder<'a> {
    data: &'a [u8],
    offset: usize,
}

impl<'a> Decoder<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self { data, offset: 0 }
    }

    fn remaining(&self) -> usize {
        self.data.len().saturating_sub(self.offset)
    }

    fn next_opcode(&mut self) -> Result<Option<OpCode>, JsValue> {
        if self.remaining() == 0 {
            return Ok(None);
        }
        let byte = self.data[self.offset];
        self.offset += 1;
        OpCode::from_byte(byte).ok_or_else(|| JsValue::from_str("Unknown opcode")).map(Some)
    }

    fn read_f32(&mut self) -> Result<f32, JsValue> {
        if self.remaining() < 4 {
            return Err(JsValue::from_str("Unexpected end of buffer"));
        }
        let chunk = &self.data[self.offset..self.offset + 4];
        self.offset += 4;
        Ok(f32::from_le_bytes(chunk.try_into().unwrap()))
    }

    fn read_mat3(&mut self) -> Result<[f32; 6], JsValue> {
        let mut values = [0.0; 6];
        for slot in &mut values {
            *slot = self.read_f32()?;
        }
        Ok(values)
    }

    fn read_u8(&mut self) -> Result<u8, JsValue> {
        if self.remaining() < 1 {
            return Err(JsValue::from_str("Unexpected end of buffer"));
        }
        let value = self.data[self.offset];
        self.offset += 1;
        Ok(value)
    }

    fn read_u32(&mut self) -> Result<u32, JsValue> {
        if self.remaining() < 4 {
            return Err(JsValue::from_str("Unexpected end of buffer"));
        }
        let chunk = &self.data[self.offset..self.offset + 4];
        self.offset += 4;
        Ok(u32::from_le_bytes(chunk.try_into().unwrap()))
    }

    fn read_string(&mut self, len: usize) -> Result<String, JsValue> {
        if self.remaining() < len {
            return Err(JsValue::from_str("Unexpected end of buffer"));
        }
        let bytes = &self.data[self.offset..self.offset + len];
        self.offset += len;
        String::from_utf8(bytes.to_vec())
            .map_err(|_| JsValue::from_str("Invalid UTF-8 in path data"))
    }
}

#[derive(Debug, Copy, Clone)]
enum OpCode {
    BeginFrame = 1,
    Rect = 2,
    Path = 3,
    EndFrame = 255,
}

impl OpCode {
    fn from_byte(byte: u8) -> Option<Self> {
        match byte {
            1 => Some(OpCode::BeginFrame),
            2 => Some(OpCode::Rect),
            3 => Some(OpCode::Path),
            255 => Some(OpCode::EndFrame),
            _ => None,
        }
    }
}

#[wasm_bindgen(start)]
pub fn wasm_start() {
    console_error_panic_hook::set_once();
}
