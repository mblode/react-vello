use std::collections::HashMap;
use std::mem;
use std::sync::Arc;

use skrifa::charmap::Charmap;
use skrifa::instance::{LocationRef, Size};
use skrifa::metrics::{GlyphMetrics, Metrics};
use skrifa::{FontRef, GlyphId, MetadataProvider};
use wasm_bindgen::prelude::*;
use web_sys::HtmlCanvasElement;

use vello::kurbo::{Affine, BezPath, Circle, Rect, RoundedRect, Stroke};
use vello::peniko::{Blob, Color, Fill, FontData};
use vello::{wgpu, AaConfig, AaSupport, Renderer, RendererOptions, Scene};

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
    /// The frame buffer JS encodes into, kept across frames so its allocation
    /// is paid for once. JS writes here directly through a view onto linear
    /// memory, so a frame crosses the boundary as a length, not as bytes.
    ops: Vec<u8>,
    /// Parsed SVG paths, keyed by their source string.
    ///
    /// `BezPath::from_svg` re-tokenises the whole path every time, and most
    /// paths in a scene are chrome that never changes. A path whose `d` really
    /// does change every frame just misses, which costs one insertion.
    paths: HashMap<String, BezPath>,
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

/// Distinct path strings kept before the cache is dropped and rebuilt.
const PATH_CACHE_LIMIT: usize = 256;

fn default_font_data() -> FontData {
    let blob = Blob::new(Arc::new(DEFAULT_FONT_BYTES));
    FontData::new(blob, 0)
}

#[wasm_bindgen]
pub async fn create_renderer(canvas: HtmlCanvasElement) -> Result<RendererHandle, JsValue> {
    install_panic_hook();

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

    // The backend is WebGPU only, so there is nothing to gain from asking for
    // WebGL2's downlevel floor — and plenty to lose. `using_resolution` only
    // lifts texture dimensions; storage-buffer counts and compute workgroup
    // sizes would stay pinned at the WebGL2 minimum, which is exactly what
    // Vello's compute rasteriser needs headroom in.
    let limits = adapter.limits();

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

    // `RendererOptions::default()` compiles area, MSAA8 and MSAA16 fine-raster
    // permutations at startup. `render` only ever asks for `AaConfig::Area`, so
    // two thirds of that shader compilation was paid for and never used.
    let renderer = Renderer::new(
        &device,
        RendererOptions {
            antialiasing_support: AaSupport::area_only(),
            ..Default::default()
        },
    )
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
        ops: Vec::new(),
        paths: HashMap::new(),
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

    /// Grows the frame buffer to at least `len` bytes and hands back a pointer
    /// into linear memory.
    ///
    /// Existing contents survive — `Vec::resize` copies them to the new
    /// allocation and `memory.grow` preserves the old pages — so JS can call
    /// this part-way through encoding a frame, re-derive its view, and carry on
    /// writing where it left off.
    #[wasm_bindgen]
    pub fn ops_reserve(&mut self, len: usize) -> *mut u8 {
        if self.ops.len() < len {
            self.ops.resize(len, 0);
        }
        self.ops.as_mut_ptr()
    }

    /// Decodes the first `len` bytes already sitting in the frame buffer, then
    /// presents. One boundary crossing per frame, and nothing copied to get
    /// here.
    #[wasm_bindgen]
    pub fn apply_and_render(&mut self, len: usize) -> Result<(), JsValue> {
        // Moved out so the decoder can borrow the buffer while the rest of
        // `self` is mutated. The allocation is handed straight back.
        let ops = mem::take(&mut self.ops);
        let mut paths = mem::take(&mut self.paths);
        let end = len.min(ops.len());
        let result = self.apply(&ops[..end], &mut paths);
        self.ops = ops;
        self.paths = paths;
        result?;
        self.render()
    }

    fn apply(
        &mut self,
        bytes: &[u8],
        paths: &mut HashMap<String, BezPath>,
    ) -> Result<(), JsValue> {
        let mut decoder = Decoder::new(bytes);

        self.scene.reset();
        self.base_color = Color::new([0.0, 0.0, 0.0, 1.0]);

        // Parsed once per frame rather than once per text node. `FontRef` reads
        // the TTF table directory and `charmap()` resolves the cmap, and both
        // used to be redone for every `Text` op in the scene.
        //
        // Cloned because it is an `Arc` bump, and because borrowing `self.font`
        // across the loop would lock out the `&mut self` the decoder needs.
        let font = self.font.clone();
        let font_ref = FontRef::from_index(font.data.as_ref(), font.index)
            .map_err(|_| js_error("Invalid font data"))?;
        let charmap = font_ref.charmap();
        // Scenes overwhelmingly use one or two sizes, so a one-entry memo is
        // enough to stop re-deriving metrics per node.
        let mut sized: Option<(f32, Metrics, GlyphMetrics<'_>)> = None;

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
                    let affine = Affine::new([
                        transform[0] as f64,
                        transform[1] as f64,
                        transform[2] as f64,
                        transform[3] as f64,
                        transform[4] as f64,
                        transform[5] as f64,
                    ]);

                    // `RoundedRect` resolves to four lines plus four arcs, and
                    // each arc costs transcendentals to turn into cubics. The
                    // two shapes people actually ask for most — a plain
                    // rectangle and a full-radius dot — have cheaper exact
                    // forms, and a particle field is thirty thousand dots.
                    let x0 = ox as f64;
                    let y0 = oy as f64;
                    let x1 = (ox + width) as f64;
                    let y1 = (oy + height) as f64;
                    let w = (width as f64).abs();
                    let h = (height as f64).abs();
                    let r = (radius as f64).max(0.0);

                    if r <= 0.0 {
                        let rect = Rect::new(x0, y0, x1, y1);
                        self.scene.fill(Fill::NonZero, affine, color, None, &rect);
                    } else if (w - h).abs() < f64::EPSILON && r * 2.0 >= w {
                        let radius = w * 0.5;
                        let circle = Circle::new((x0 + radius, y0 + radius), radius);
                        self.scene.fill(Fill::NonZero, affine, color, None, &circle);
                    } else {
                        let rect = RoundedRect::new(x0, y0, x1, y1, r);
                        self.scene.fill(Fill::NonZero, affine, color, None, &rect);
                    }
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
                    let path_str = decoder.read_str(path_len as usize)?;

                    if !paths.contains_key(path_str) {
                        // A scene that generates a fresh path string every frame
                        // would otherwise grow this without bound.
                        if paths.len() >= PATH_CACHE_LIMIT {
                            paths.clear();
                        }
                        let Ok(parsed) = BezPath::from_svg(path_str) else {
                            continue;
                        };
                        paths.insert(path_str.to_owned(), parsed);
                    }
                    let Some(bez_path) = paths.get(path_str) else {
                        continue;
                    };

                    let fill_style = if fill_rule == 1 {
                        Fill::EvenOdd
                    } else {
                        Fill::NonZero
                    };

                    if let Some(color) = fill_color {
                        self.scene.fill(fill_style, affine, color, None, bez_path);
                    }

                    if let Some((width, color)) = stroke_info {
                        let stroke = Stroke::new(width as f64);
                        self.scene.stroke(&stroke, affine, color, None, bez_path);
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
                    let text = decoder.read_str(text_len as usize)?;

                    if text.is_empty() {
                        continue;
                    }

                    let font_size = if font_size.is_finite() && font_size > 0.0 {
                        font_size
                    } else {
                        16.0
                    };
                    if sized.as_ref().is_none_or(|(cached, _, _)| *cached != font_size) {
                        let size = Size::new(font_size);
                        sized = Some((
                            font_size,
                            font_ref.metrics(size, LocationRef::default()),
                            font_ref.glyph_metrics(size, LocationRef::default()),
                        ));
                    }
                    let (_, metrics, glyph_metrics) =
                        sized.as_ref().ok_or_else(|| js_error("Missing font metrics"))?;
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

                    let lines = wrap_text_lines(text, max_width, &charmap, glyph_metrics, fallback_width);
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

                    // One glyph per char at most; `char_indices` would be a
                    // second pass just to count, and `len()` is a safe ceiling.
                    let mut glyphs = Vec::with_capacity(text.len());
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
                        // The blit is a fullscreen triangle, so every pixel is
                        // overwritten. Loading first only costs a tile read,
                        // which is real bandwidth on mobile and Apple silicon.
                        load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
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

/// Borrows out of the text being laid out. Wrapping picks break points, it does
/// not rewrite the string, so there is nothing here worth owning.
struct LineLayout<'a> {
    text: &'a str,
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

    /// Borrows out of the frame buffer rather than copying. A path or a text run
    /// is read once and used immediately, so there is no reason to own it.
    fn read_str(&mut self, len: usize) -> Result<&'a str, JsValue> {
        if self.remaining() < len {
            return Err(JsValue::from_str("Unexpected end of buffer"));
        }
        let bytes = &self.data[self.offset..self.offset + len];
        self.offset += len;
        std::str::from_utf8(bytes).map_err(|_| JsValue::from_str("Invalid UTF-8 in frame data"))
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

/// Byte offset of `part` within `whole`. Sound only for slices produced from
/// `whole`, which is the case for everything `split_whitespace` yields.
fn offset_in(whole: &str, part: &str) -> usize {
    part.as_ptr() as usize - whole.as_ptr() as usize
}

fn wrap_text_lines<'a>(
    text: &'a str,
    max_width: f32,
    charmap: &Charmap<'_>,
    glyph_metrics: &GlyphMetrics<'_>,
    fallback_width: f32,
) -> Vec<LineLayout<'a>> {
    let mut lines = Vec::new();
    let wrap = max_width.is_finite() && max_width > 0.0;
    let space_width = measure_text_width(" ", charmap, glyph_metrics, fallback_width);

    for raw_line in text.split('\n') {
        if !wrap {
            let width = measure_text_width(raw_line, charmap, glyph_metrics, fallback_width);
            lines.push(LineLayout {
                text: raw_line,
                width,
            });
            continue;
        }

        // Each line is a range of the source rather than a rebuilt string, so
        // the author's own spacing survives instead of being collapsed.
        let mut start: Option<usize> = None;
        let mut end = 0usize;
        let mut current_width = 0.0;
        let mut pushed = false;

        for word in raw_line.split_whitespace() {
            let word_start = offset_in(raw_line, word);
            let word_end = word_start + word.len();
            let word_width = measure_text_width(word, charmap, glyph_metrics, fallback_width);

            let Some(line_start) = start else {
                start = Some(word_start);
                end = word_end;
                current_width = word_width;
                continue;
            };

            let next_width = current_width + space_width + word_width;
            if next_width <= max_width {
                end = word_end;
                current_width = next_width;
            } else {
                lines.push(LineLayout {
                    text: &raw_line[line_start..end],
                    width: current_width,
                });
                pushed = true;
                start = Some(word_start);
                end = word_end;
                current_width = word_width;
            }
        }

        match start {
            Some(line_start) => lines.push(LineLayout {
                text: &raw_line[line_start..end],
                width: current_width,
            }),
            // A blank line still occupies a line box.
            None if !pushed => lines.push(LineLayout {
                text: "",
                width: 0.0,
            }),
            None => {}
        }
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

/// No-op unless the `debug-panics` feature is on, which keeps the panic
/// formatting machinery out of the shipped binary.
fn install_panic_hook() {
    #[cfg(feature = "debug-panics")]
    console_error_panic_hook::set_once();
}

/// The module's linear memory, so JS can build views over the frame buffer that
/// `ops_reserve` hands out pointers into.
#[wasm_bindgen]
pub fn wasm_memory() -> JsValue {
    wasm_bindgen::memory()
}

#[wasm_bindgen(start)]
pub fn wasm_start() {
    install_panic_hook();
}
