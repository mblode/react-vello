use std::mem;
use std::sync::Arc;

use js_sys::Uint8Array;
use skrifa::charmap::Charmap;
use skrifa::instance::{LocationRef, Size};
use skrifa::metrics::GlyphMetrics;
use skrifa::{FontRef, GlyphId, MetadataProvider};
use wasm_bindgen::prelude::*;
use web_sys::HtmlCanvasElement;

use vello::kurbo::{Affine, BezPath, RoundedRect, Stroke};
use vello::peniko::{Blob, Color, Fill, FontData};
use vello::{wgpu, AaConfig, Renderer, RendererOptions, Scene};

#[wasm_bindgen]
pub struct RendererHandle {
    #[allow(dead_code)]
    _canvas: HtmlCanvasElement,
    device: wgpu::Device,
    queue: wgpu::Queue,
    surface: wgpu::Surface<'static>,
    config: wgpu::SurfaceConfiguration,
    renderer: Renderer,
    scene: Scene,
    font: FontData,
    base_color: Color,
    storage_format: wgpu::TextureFormat,
    offscreen: Option<OffscreenTarget>,
    sampler: wgpu::Sampler,
    present_bind_group_layout: wgpu::BindGroupLayout,
    present_bind_group: Option<wgpu::BindGroup>,
    present_pipeline: Option<PresentPipeline>,
}

struct OffscreenTarget {
    #[allow(dead_code)]
    texture: wgpu::Texture,
    view: wgpu::TextureView,
    width: u32,
    height: u32,
}

struct PresentPipeline {
    pipeline: wgpu::RenderPipeline,
    format: wgpu::TextureFormat,
}

const DEFAULT_FONT_BYTES: &[u8] = include_bytes!("../assets/space-grotesk-regular.ttf");

fn default_font_data() -> FontData {
    let blob = Blob::new(Arc::new(DEFAULT_FONT_BYTES));
    FontData::new(blob, 0)
}

#[wasm_bindgen]
pub async fn create_renderer(canvas: HtmlCanvasElement) -> Result<RendererHandle, JsValue> {
    console_error_panic_hook::set_once();

    let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
        backends: wgpu::Backends::BROWSER_WEBGPU,
        ..Default::default()
    });

    let surface = instance
        .create_surface(wgpu::SurfaceTarget::Canvas(canvas.clone()))
        .map_err(|err| js_error(&format!("Failed to create WebGPU surface: {err:?}")))?;

    let adapter = instance
        .request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            force_fallback_adapter: false,
            compatible_surface: Some(&surface),
        })
        .await
        .map_err(|err| js_error(&format!("Failed to acquire WebGPU adapter: {err:?}")))?;

    let limits = wgpu::Limits::downlevel_webgl2_defaults().using_resolution(adapter.limits());

    let (device, queue) = adapter
        .request_device(&wgpu::DeviceDescriptor {
            label: Some("rvello-device"),
            required_features: wgpu::Features::empty(),
            required_limits: limits,
            memory_hints: wgpu::MemoryHints::Performance,
            trace: wgpu::Trace::default(),
        })
        .await
        .map_err(|err| js_error(&format!("Failed to request WebGPU device: {err:?}")))?;

    let caps = surface.get_capabilities(&adapter);
    let surface_format = caps
        .formats
        .first()
        .copied()
        .unwrap_or(wgpu::TextureFormat::Bgra8Unorm);
    let storage_format = select_storage_format(&adapter)
        .ok_or_else(|| js_error("Adapter does not support a storage-compatible render format"))?;
    let present_mode = select_present_mode(&caps.present_modes);
    let alpha_mode = select_alpha_mode(&caps.alpha_modes);

    let width = canvas.width().max(1);
    let height = canvas.height().max(1);

    let config = wgpu::SurfaceConfiguration {
        usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
        format: surface_format,
        width,
        height,
        present_mode,
        desired_maximum_frame_latency: 2,
        alpha_mode,
        view_formats: vec![surface_format],
    };
    surface.configure(&device, &config);

    let renderer = Renderer::new(&device, RendererOptions::default())
        .map_err(|err| js_error(&format!("Failed to create Vello renderer: {err:?}")))?;

    let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
        label: Some("rvello-present-sampler"),
        mag_filter: wgpu::FilterMode::Linear,
        min_filter: wgpu::FilterMode::Linear,
        mipmap_filter: wgpu::FilterMode::Nearest,
        ..Default::default()
    });

    let present_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
        label: Some("rvello-present-bind-group-layout"),
        entries: &[
            wgpu::BindGroupLayoutEntry {
                binding: 0,
                visibility: wgpu::ShaderStages::FRAGMENT,
                ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                count: None,
            },
            wgpu::BindGroupLayoutEntry {
                binding: 1,
                visibility: wgpu::ShaderStages::FRAGMENT,
                ty: wgpu::BindingType::Texture {
                    multisampled: false,
                    view_dimension: wgpu::TextureViewDimension::D2,
                    sample_type: wgpu::TextureSampleType::Float { filterable: true },
                },
                count: None,
            },
        ],
    });

    Ok(RendererHandle {
        _canvas: canvas,
        device,
        queue,
        surface: leak_surface(surface),
        config,
        renderer,
        scene: Scene::new(),
        font: default_font_data(),
        base_color: Color::new([0.0, 0.0, 0.0, 1.0]),
        storage_format,
        offscreen: None,
        sampler,
        present_bind_group_layout,
        present_bind_group: None,
        present_pipeline: None,
    })
}

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
        self.offscreen = None;
        self.present_bind_group = None;
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
                OpCode::Text => {
                    let opacity = decoder.read_f32()?;
                    let transform = decoder.read_mat3()?;
                    let ox = decoder.read_f32()?;
                    let oy = decoder.read_f32()?;
                    let font_size = decoder.read_f32()?;
                    let line_height = decoder.read_f32()?;
                    let max_width = decoder.read_f32()?;
                    let align = TextAlign::from_u8(decoder.read_u8()?);
                    let r = decoder.read_f32()?;
                    let g = decoder.read_f32()?;
                    let b = decoder.read_f32()?;
                    let a = decoder.read_f32()?;
                    let text_len = decoder.read_u32()?;
                    let text = decoder.read_string(text_len as usize)?;

                    if text.is_empty() {
                        continue;
                    }

                    let font_size = if font_size.is_finite() && font_size > 0.0 {
                        font_size
                    } else {
                        16.0
                    };
                    let font_ref = FontRef::from_index(self.font.data.as_ref(), self.font.index)
                        .map_err(|_| js_error("Invalid font data"))?;
                    let size = Size::new(font_size);
                    let metrics = font_ref.metrics(size, LocationRef::default());
                    let glyph_metrics = font_ref.glyph_metrics(size, LocationRef::default());
                    let ascent = if metrics.ascent.is_finite() {
                        metrics.ascent
                    } else {
                        font_size * 0.8
                    };
                    let descent = if metrics.descent.is_finite() {
                        metrics.descent
                    } else {
                        -font_size * 0.2
                    };
                    let leading = if metrics.leading.is_finite() {
                        metrics.leading
                    } else {
                        0.0
                    };
                    let fallback_width = metrics
                        .average_width
                        .filter(|width| width.is_finite() && *width > 0.0)
                        .unwrap_or(font_size * 0.5);
                    let line_height = if line_height.is_finite() && line_height > 0.0 {
                        line_height
                    } else {
                        let base = ascent - descent + leading;
                        if base.is_finite() && base > 0.0 {
                            base
                        } else {
                            font_size * 1.2
                        }
                    };

                    let charmap = font_ref.charmap();
                    let lines = wrap_text_lines(&text, max_width, &charmap, &glyph_metrics, fallback_width);
                    if lines.is_empty() {
                        continue;
                    }

                    let color = Color::new([r, g, b, (a * opacity).clamp(0.0, 1.0)]);
                    let affine = Affine::new([
                        transform[0] as f64,
                        transform[1] as f64,
                        transform[2] as f64,
                        transform[3] as f64,
                        transform[4] as f64,
                        transform[5] as f64,
                    ]);

                    let mut glyphs = Vec::new();
                    let mut y = oy + ascent;
                    for line in lines {
                        let offset_x = align_offset(align, max_width, line.width);
                        let mut x = ox + offset_x;
                        for ch in line.text.chars() {
                            if ch == '\t' {
                                x += fallback_width * 4.0;
                                continue;
                            }
                            let glyph_id = charmap.map(ch).unwrap_or(GlyphId::NOTDEF);
                            glyphs.push(vello::Glyph {
                                id: glyph_id.to_u32(),
                                x,
                                y,
                            });
                            x += glyph_metrics.advance_width(glyph_id).unwrap_or(fallback_width);
                        }
                        y += line_height;
                    }

                    if !glyphs.is_empty() {
                        self.scene
                            .draw_glyphs(&self.font)
                            .font_size(font_size)
                            .transform(affine)
                            .brush(color)
                            .draw(Fill::NonZero, glyphs.into_iter());
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
                    .map_err(|e| JsValue::from_str(&format!("Failed to acquire surface: {e:?}")))?
            }
        };

        let view = frame
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());
        let width = self.config.width;
        let height = self.config.height;
        let base_color = self.base_color;
        let offscreen_view = {
            let target = self.ensure_offscreen_target();
            target.view.clone()
        };
        let present_bind_group = self.ensure_present_bind_group(&offscreen_view).clone();
        let pipeline = self.ensure_present_pipeline().clone();
        let params = vello::RenderParams {
            base_color,
            width,
            height,
            antialiasing_method: AaConfig::Area,
        };

        self.renderer
            .render_to_texture(&self.device, &self.queue, &self.scene, &offscreen_view, &params)
            .map_err(|err| JsValue::from_str(&format!("Render failed: {err:?}")))?;

        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("rvello-present-encoder"),
            });

        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("rvello-present-pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Load,
                        store: wgpu::StoreOp::Store,
                    },
                    depth_slice: None,
                })],
                depth_stencil_attachment: None,
                occlusion_query_set: None,
                timestamp_writes: None,
            });
            pass.set_pipeline(&pipeline);
            pass.set_bind_group(0, &present_bind_group, &[]);
            pass.draw(0..3, 0..1);
        }

        self.queue.submit(Some(encoder.finish()));
        frame.present();
        Ok(())
    }
}

impl RendererHandle {
    fn ensure_offscreen_target(&mut self) -> &OffscreenTarget {
        let needs_recreate = self
            .offscreen
            .as_ref()
            .map_or(true, |target| target.width != self.config.width || target.height != self.config.height);

        if needs_recreate {
            let format = self.storage_format;
            let texture = self.device.create_texture(&wgpu::TextureDescriptor {
                label: Some("rvello-offscreen-texture"),
                size: wgpu::Extent3d {
                    width: self.config.width.max(1),
                    height: self.config.height.max(1),
                    depth_or_array_layers: 1,
                },
                mip_level_count: 1,
                sample_count: 1,
                dimension: wgpu::TextureDimension::D2,
                format,
                usage: wgpu::TextureUsages::TEXTURE_BINDING
                    | wgpu::TextureUsages::STORAGE_BINDING
                    | wgpu::TextureUsages::COPY_SRC
                    | wgpu::TextureUsages::RENDER_ATTACHMENT,
                view_formats: &[],
            });
            let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
            self.offscreen = Some(OffscreenTarget {
                texture,
                view,
                width: self.config.width,
                height: self.config.height,
            });
            self.present_bind_group = None;
        }

        self.offscreen.as_ref().unwrap()
    }

    fn ensure_present_bind_group(&mut self, view: &wgpu::TextureView) -> &wgpu::BindGroup {
        if self.present_bind_group.is_none() {
            let bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("rvello-present-bind-group"),
                layout: &self.present_bind_group_layout,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: wgpu::BindingResource::Sampler(&self.sampler),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: wgpu::BindingResource::TextureView(view),
                    },
                ],
            });
            self.present_bind_group = Some(bind_group);
        }
        self.present_bind_group.as_ref().unwrap()
    }

    fn ensure_present_pipeline(&mut self) -> &wgpu::RenderPipeline {
        let format = self.config.format;
        let recreate = self
            .present_pipeline
            .as_ref()
            .map_or(true, |pipeline| pipeline.format != format);

        if recreate {
            let shader = self.device.create_shader_module(wgpu::ShaderModuleDescriptor {
                label: Some("rvello-present-shader"),
                source: wgpu::ShaderSource::Wgsl(include_str!("present.wgsl").into()),
            });
            let pipeline_layout = self.device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("rvello-present-pipeline-layout"),
                bind_group_layouts: &[&self.present_bind_group_layout],
                push_constant_ranges: &[],
            });
            let pipeline = self.device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: Some("rvello-present-pipeline"),
                layout: Some(&pipeline_layout),
                vertex: wgpu::VertexState {
                    module: &shader,
                    entry_point: Some("vs_main"),
                    buffers: &[],
                    compilation_options: Default::default(),
                },
                fragment: Some(wgpu::FragmentState {
                    module: &shader,
                    entry_point: Some("fs_main"),
                    targets: &[Some(wgpu::ColorTargetState {
                        format,
                        blend: Some(wgpu::BlendState::ALPHA_BLENDING),
                        write_mask: wgpu::ColorWrites::ALL,
                    })],
                    compilation_options: Default::default(),
                }),
                primitive: wgpu::PrimitiveState {
                    topology: wgpu::PrimitiveTopology::TriangleList,
                    ..Default::default()
                },
                depth_stencil: None,
                multisample: wgpu::MultisampleState::default(),
                multiview: None,
                cache: None,
            });
            self.present_pipeline = Some(PresentPipeline { pipeline, format });
        }

        &self.present_pipeline.as_ref().unwrap().pipeline
    }
}

fn leak_surface(surface: wgpu::Surface<'_>) -> wgpu::Surface<'static> {
    unsafe { mem::transmute(surface) }
}

fn select_storage_format(adapter: &wgpu::Adapter) -> Option<wgpu::TextureFormat> {
    const PREFERRED: &[wgpu::TextureFormat] = &[
        wgpu::TextureFormat::Rgba8Unorm,
        wgpu::TextureFormat::Rgba8UnormSrgb,
        wgpu::TextureFormat::Bgra8Unorm,
        wgpu::TextureFormat::Bgra8UnormSrgb,
    ];

    for format in PREFERRED {
        if format_supports_storage(*format, adapter) {
            return Some(*format);
        }
    }

    None
}

fn format_supports_storage(format: wgpu::TextureFormat, adapter: &wgpu::Adapter) -> bool {
    adapter
        .get_texture_format_features(format)
        .allowed_usages
        .contains(wgpu::TextureUsages::STORAGE_BINDING)
}

fn select_present_mode(modes: &[wgpu::PresentMode]) -> wgpu::PresentMode {
    if modes.contains(&wgpu::PresentMode::Fifo) {
        wgpu::PresentMode::Fifo
    } else {
        modes.first().copied().unwrap_or(wgpu::PresentMode::Fifo)
    }
}

fn select_alpha_mode(modes: &[wgpu::CompositeAlphaMode]) -> wgpu::CompositeAlphaMode {
    for preferred in [
        wgpu::CompositeAlphaMode::PreMultiplied,
        wgpu::CompositeAlphaMode::Opaque,
    ] {
        if modes.contains(&preferred) {
            return preferred;
        }
    }
    modes
        .first()
        .copied()
        .unwrap_or(wgpu::CompositeAlphaMode::Auto)
}

fn js_error(message: &str) -> JsValue {
    JsValue::from_str(message)
}

#[derive(Copy, Clone)]
enum TextAlign {
    Start,
    Center,
    End,
}

impl TextAlign {
    fn from_u8(value: u8) -> Self {
        match value {
            1 => TextAlign::Center,
            2 => TextAlign::End,
            _ => TextAlign::Start,
        }
    }
}

struct LineLayout {
    text: String,
    width: f32,
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
        OpCode::from_byte(byte)
            .ok_or_else(|| JsValue::from_str("Unknown opcode"))
            .map(Some)
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
    Text = 4,
    EndFrame = 255,
}

impl OpCode {
    fn from_byte(byte: u8) -> Option<Self> {
        match byte {
            1 => Some(OpCode::BeginFrame),
            2 => Some(OpCode::Rect),
            3 => Some(OpCode::Path),
            4 => Some(OpCode::Text),
            255 => Some(OpCode::EndFrame),
            _ => None,
        }
    }
}

fn measure_text_width(
    text: &str,
    charmap: &Charmap<'_>,
    glyph_metrics: &GlyphMetrics<'_>,
    fallback_width: f32,
) -> f32 {
    let mut width = 0.0;
    for ch in text.chars() {
        if ch == '\t' {
            width += fallback_width * 4.0;
            continue;
        }
        let glyph_id = charmap.map(ch).unwrap_or(GlyphId::NOTDEF);
        width += glyph_metrics.advance_width(glyph_id).unwrap_or(fallback_width);
    }
    width
}

fn wrap_text_lines(
    text: &str,
    max_width: f32,
    charmap: &Charmap<'_>,
    glyph_metrics: &GlyphMetrics<'_>,
    fallback_width: f32,
) -> Vec<LineLayout> {
    let mut lines = Vec::new();
    let wrap = max_width.is_finite() && max_width > 0.0;
    let space_width = measure_text_width(" ", charmap, glyph_metrics, fallback_width);

    for raw_line in text.split('\n') {
        if !wrap {
            let width = measure_text_width(raw_line, charmap, glyph_metrics, fallback_width);
            lines.push(LineLayout {
                text: raw_line.to_string(),
                width,
            });
            continue;
        }

        let words: Vec<&str> = raw_line.split_whitespace().collect();
        if words.is_empty() {
            lines.push(LineLayout {
                text: String::new(),
                width: 0.0,
            });
            continue;
        }

        let mut current = String::new();
        let mut current_width = 0.0;

        for word in words {
            let word_width = measure_text_width(word, charmap, glyph_metrics, fallback_width);
            if current.is_empty() {
                current.push_str(word);
                current_width = word_width;
                continue;
            }

            let next_width = current_width + space_width + word_width;
            if next_width <= max_width {
                current.push(' ');
                current.push_str(word);
                current_width = next_width;
            } else {
                lines.push(LineLayout {
                    text: current,
                    width: current_width,
                });
                current = word.to_string();
                current_width = word_width;
            }
        }

        lines.push(LineLayout {
            text: current,
            width: current_width,
        });
    }

    lines
}

fn align_offset(align: TextAlign, max_width: f32, line_width: f32) -> f32 {
    let width = if max_width.is_finite() && max_width > 0.0 {
        max_width
    } else {
        line_width
    };
    match align {
        TextAlign::Start => 0.0,
        TextAlign::Center => (width - line_width) * 0.5,
        TextAlign::End => width - line_width,
    }
}

#[wasm_bindgen(start)]
pub fn wasm_start() {
    console_error_panic_hook::set_once();
}
