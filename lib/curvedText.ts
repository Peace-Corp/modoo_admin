import * as fabric from 'fabric';
// @ts-expect-error - opentype.js lacks TypeScript declarations
import opentype from 'opentype.js';

/**
 * CurvedText - Custom canvas object that renders text along a curve
 * Uses actual path warping to bend letter shapes along the curve
 *
 * curveIntensity: -100 to 100
 * - Negative: curves upward
 * - Zero: straight
 * - Positive: curves downward
 */

interface CurvedTextOptions {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  originX?: fabric.TOriginX;
  originY?: fabric.TOriginY;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  charSpacing?: number;
  curveIntensity?: number;
  opacity?: number;
  angle?: number;
  fontUrl?: string;
  scaleX?: number;
  scaleY?: number;
  // Flag to indicate this is being restored from saved state
  _fromSavedState?: boolean;
}

// Font cache to avoid reloading
const fontCache: Map<string, opentype.Font> = new Map();

// Track which fonts have been loaded via FontFace API
const loadedFontFaces = new Set<string>();

/**
 * Load a custom font using the FontFace API for normal text rendering
 * @param fontFamily - The font family name to register
 * @param fontUrl - URL to the font file (TTF, OTF, WOFF)
 * @returns Promise that resolves when the font is loaded
 */
async function loadFontFace(fontFamily: string, fontUrl: string): Promise<void> {
  if (typeof document === 'undefined') return;

  const fontKey = `${fontFamily}:${fontUrl}`;
  if (loadedFontFaces.has(fontKey)) {
    return;
  }

  try {
    // Check if font is already available
    if (document.fonts.check(`12px "${fontFamily}"`)) {
      loadedFontFaces.add(fontKey);
      return;
    }

    // Create and load the FontFace
    const fontFace = new FontFace(fontFamily, `url(${fontUrl})`, {
      style: 'normal',
      weight: '400',
    });

    const loadedFont = await fontFace.load();
    document.fonts.add(loadedFont);
    loadedFontFaces.add(fontKey);
    console.log(`[FontFace] Loaded font for normal text: ${fontFamily}`);
  } catch (error) {
    console.warn(`[FontFace] Failed to load font ${fontFamily}:`, error);
    // Don't throw - continue with fallback font
  }
}

/**
 * Load a custom font and cache it for use with CurvedText
 * @param fontFamily - The font family name to register
 * @param fontUrl - URL to the font file (TTF, OTF, WOFF)
 * @returns Promise that resolves when the font is loaded
 */
export async function loadCustomFont(fontFamily: string, fontUrl: string): Promise<void> {
  const fontKey = fontUrl || fontFamily;

  // Load for both CurvedText (opentype.js) and normal text (FontFace API)
  const promises: Promise<void>[] = [];

  // Load via FontFace API for normal text objects (IText, Text, Textbox)
  promises.push(loadFontFace(fontFamily, fontUrl));

  // Load via opentype.js for CurvedText (only if not already cached)
  if (!fontCache.has(fontKey)) {
    promises.push(
      opentype.load(fontUrl).then((font: opentype.Font) => {
        fontCache.set(fontKey, font);
        // Also cache by font family name for lookup
        fontCache.set(fontFamily, font);
        console.log(`[CurvedText] Loaded custom font: ${fontFamily}`);
      }).catch((error: Error) => {
        console.warn(`[CurvedText] Failed to load custom font ${fontFamily}:`, error);
        // Don't throw - continue with fallback rendering
      })
    );
  }

  await Promise.all(promises);
}

/**
 * Load multiple custom fonts
 * @param fonts - Array of { fontFamily, url } objects
 * @returns Promise that resolves when all fonts are loaded (or failed)
 */
export async function loadCustomFonts(fonts: Array<{ fontFamily: string; url: string }>): Promise<void> {
  const loadPromises = fonts.map(async (font) => {
    try {
      await loadCustomFont(font.fontFamily, font.url);
    } catch {
      // Silently continue on font load failure - will use fallback rendering
    }
  });

  await Promise.all(loadPromises);
}

/**
 * Check if a custom font is already loaded in cache
 */
export function isFontLoaded(fontFamilyOrUrl: string): boolean {
  return fontCache.has(fontFamilyOrUrl);
}

// System font URLs (using Google Fonts CDN)
const systemFontUrls: Record<string, string> = {
  'Arial': 'https://fonts.gstatic.com/s/arimo/v29/P5sfzZCDf9_T_3cV7NCUECyoxNk.ttf',
  'Times New Roman': 'https://fonts.gstatic.com/s/tinos/v24/buE4poGnedXvwgX8dGVh8TI-.ttf',
  'Courier New': 'https://fonts.gstatic.com/s/cousine/v27/d6lIkaiiRdih4SpPzSMlzTbtz9k.ttf',
  'Georgia': 'https://fonts.gstatic.com/s/tinos/v24/buE4poGnedXvwgX8dGVh8TI-.ttf',
  'Verdana': 'https://fonts.gstatic.com/s/arimo/v29/P5sfzZCDf9_T_3cV7NCUECyoxNk.ttf',
  'Helvetica': 'https://fonts.gstatic.com/s/arimo/v29/P5sfzZCDf9_T_3cV7NCUECyoxNk.ttf',
};

export class CurvedText extends fabric.FabricObject {
  static type = 'CurvedText';

  // Text properties
  text: string = 'Text';
  fontSize: number = 40;
  fontFamily: string = 'Arial';
  fontWeight: string = 'normal';
  fontStyle: string = 'normal';
  fill: string = '#000000';
  stroke: string = '';
  strokeWidth: number = 0;
  charSpacing: number = 0;

  // Curve intensity: -100 to 100
  curveIntensity: number = 0;

  // Font URL for custom fonts
  fontUrl: string = '';

  // Loaded font reference
  private _loadedFont: opentype.Font | null = null;
  private _fontLoadPromise: Promise<void> | null = null;

  // For editing
  private _isEditing: boolean = false;
  private _editingTextarea: HTMLTextAreaElement | null = null;

  // Flag to skip bounds recalculation when restoring from saved state
  private _fromSavedState: boolean = false;

  constructor(options?: CurvedTextOptions) {
    super(options);

    this.text = options?.text ?? 'Text';
    this.fontSize = options?.fontSize ?? 40;
    this.fontFamily = options?.fontFamily ?? 'Arial';
    this.fontWeight = options?.fontWeight ?? 'normal';
    this.fontStyle = options?.fontStyle ?? 'normal';
    this.fill = options?.fill ?? '#000000';
    this.stroke = options?.stroke ?? '';
    this.strokeWidth = options?.strokeWidth ?? 0;
    this.charSpacing = options?.charSpacing ?? 0;
    this.curveIntensity = options?.curveIntensity ?? 0;
    this.fontUrl = options?.fontUrl ?? '';

    // Track if this is being restored from saved state
    this._fromSavedState = options?._fromSavedState ?? false;

    // Set default dimensions if not provided
    this.width = options?.width ?? 200;
    this.height = options?.height ?? this.fontSize * 1.2;

    // Start loading font
    this._loadFont();
  }

  /**
   * Load font using opentype.js
   */
  private async _loadFont(): Promise<void> {
    const fontKey = this.fontUrl || this.fontFamily;

    // Check cache first
    if (fontCache.has(fontKey)) {
      this._loadedFont = fontCache.get(fontKey)!;
      return;
    }

    // Determine font URL
    let url = this.fontUrl;
    if (!url) {
      url = systemFontUrls[this.fontFamily] || systemFontUrls['Arial'];
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this._fontLoadPromise = opentype.load(url).then((font: any) => {
        this._loadedFont = font;
        fontCache.set(fontKey, font);
        // Only recalculate bounds if not restoring from saved state
        // Saved state already has correct dimensions
        if (!this._fromSavedState) {
          this._updateBoundsForCurve();
        }
        this.dirty = true;
        this.setCoords();
        this.canvas?.requestRenderAll();
      });
      await this._fontLoadPromise;
    } catch (error) {
      console.warn(`Failed to load font ${this.fontFamily}, using fallback rendering:`, error);
      this._loadedFont = null;
    }
  }

  /**
   * Update bounding box based on actual warped path bounds
   */
  private _updateBoundsForCurve(): void {
    if (this.curveIntensity === 0) {
      // For straight text, recalculate both width and height based on text measurements
      this._updateBoundsForText();
      this.height = this.fontSize * 1.2;
      return;
    }

    // Calculate actual bounds from warped path
    const bounds = this._calculateWarpedBounds();
    if (bounds) {
      this.width = bounds.width;
      this.height = bounds.height;
    } else {
      // Fallback: calculate bounds for rotation-based rendering
      const fallbackBounds = this._calculateFallbackBounds();
      if (fallbackBounds) {
        this.width = fallbackBounds.width;
        this.height = fallbackBounds.height;
      } else {
        // Last resort estimation
        const absIntensity = Math.abs(this.curveIntensity) / 100;
        const baseHeight = this.fontSize * 1.2;
        if (absIntensity > 0.3) {
          const targetHeight = baseHeight + (this.width! - baseHeight) * absIntensity;
          this.height = Math.max(targetHeight, baseHeight);
        } else {
          this.height = baseHeight;
        }
      }
    }
  }

  /**
   * Calculate bounds for fallback (rotation-based) rendering
   */
  private _calculateFallbackBounds(): { width: number; height: number } | null {
    // Create temporary canvas to measure text
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.font = this._buildFont();

    const chars = this.text.split('');
    const charWidths = chars.map(c => ctx.measureText(c).width);
    const spacing = (this.charSpacing || 0) / 1000 * this.fontSize;
    const totalTextWidth = charWidths.reduce((sum, w) => sum + w, 0) + spacing * Math.max(0, chars.length - 1);

    const intensity = this.curveIntensity / 100;
    const absIntensity = Math.abs(intensity);
    const arcAngle = 2 * Math.PI * absIntensity;

    if (arcAngle < 0.01) return null;

    const radius = totalTextWidth / arcAngle;
    const startAngle = intensity < 0
      ? -Math.PI / 2 - arcAngle / 2
      : Math.PI / 2 - arcAngle / 2;

    const sagitta = radius * (1 - Math.cos(arcAngle / 2));
    const offsetY = intensity < 0
      ? radius - sagitta / 2
      : -radius + sagitta / 2;

    // Calculate bounds by tracking character positions
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    let currentArcPos = 0;
    const charHeight = this.fontSize;

    chars.forEach((_, i) => {
      const charW = charWidths[i];
      const charArcPos = currentArcPos + charW / 2;

      const t = charArcPos / totalTextWidth;
      const angle = startAngle + arcAngle * t;

      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius + offsetY;

      // Account for character size (rough estimation)
      const halfChar = charHeight / 2;
      minX = Math.min(minX, x - halfChar);
      minY = Math.min(minY, y - halfChar);
      maxX = Math.max(maxX, x + halfChar);
      maxY = Math.max(maxY, y + halfChar);

      currentArcPos += charW + spacing;
    });

    if (minX === Infinity) return null;

    return {
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Calculate the actual bounds of the warped text path
   */
  private _calculateWarpedBounds(): { width: number; height: number; minX: number; minY: number; maxX: number; maxY: number } | null {
    const font = this._loadedFont;
    if (!font || !this.text) return null;

    const intensity = this.curveIntensity / 100;
    const absIntensity = Math.abs(intensity);
    const arcAngle = 2 * Math.PI * absIntensity;

    if (arcAngle < 0.01) return null;

    // Get text metrics
    const scale = this.fontSize / font.unitsPerEm;
    const spacing = (this.charSpacing || 0) / 1000 * this.fontSize;

    // Calculate total text width
    let totalWidth = 0;
    for (let i = 0; i < this.text.length; i++) {
      const glyph = font.charToGlyph(this.text[i]);
      totalWidth += (glyph.advanceWidth || 0) * scale;
      if (i < this.text.length - 1) {
        totalWidth += spacing;
      }
    }

    const radius = totalWidth / arcAngle;
    const centerAngle = intensity < 0 ? -Math.PI / 2 : Math.PI / 2;
    const startAngle = centerAngle - arcAngle / 2;
    const sagitta = radius * (1 - Math.cos(arcAngle / 2));
    const offsetY = intensity < 0
      ? radius - sagitta / 2
      : -radius + sagitta / 2;

    // Track bounds
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    let currentX = 0;

    for (let i = 0; i < this.text.length; i++) {
      const char = this.text[i];
      const glyph = font.charToGlyph(char);
      const glyphPath = glyph.getPath(0, 0, this.fontSize);

      for (const cmd of glyphPath.commands) {
        const points: { x: number; y: number }[] = [];

        if (cmd.type === 'M' || cmd.type === 'L') {
          points.push(this._warpPoint(cmd.x!, cmd.y!, currentX, totalWidth, radius, startAngle, arcAngle, offsetY, intensity));
        } else if (cmd.type === 'C') {
          points.push(this._warpPoint(cmd.x1!, cmd.y1!, currentX, totalWidth, radius, startAngle, arcAngle, offsetY, intensity));
          points.push(this._warpPoint(cmd.x2!, cmd.y2!, currentX, totalWidth, radius, startAngle, arcAngle, offsetY, intensity));
          points.push(this._warpPoint(cmd.x!, cmd.y!, currentX, totalWidth, radius, startAngle, arcAngle, offsetY, intensity));
        } else if (cmd.type === 'Q') {
          points.push(this._warpPoint(cmd.x1!, cmd.y1!, currentX, totalWidth, radius, startAngle, arcAngle, offsetY, intensity));
          points.push(this._warpPoint(cmd.x!, cmd.y!, currentX, totalWidth, radius, startAngle, arcAngle, offsetY, intensity));
        }

        for (const p of points) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
      }

      currentX += (glyph.advanceWidth || 0) * scale + spacing;
    }

    if (minX === Infinity) return null;

    return {
      width: maxX - minX,
      height: maxY - minY,
      minX,
      minY,
      maxX,
      maxY
    };
  }

  /**
   * Main render method
   */
  _render(ctx: CanvasRenderingContext2D): void {
    if (this.curveIntensity === 0) {
      this._renderStraight(ctx);
    } else if (this._loadedFont) {
      this._renderWarpedPath(ctx);
    } else {
      // Fallback to rotation-based rendering if font not loaded
      this._renderCurvedFallback(ctx);
    }
  }

  /**
   * Render straight text (no curve)
   */
  private _renderStraight(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    ctx.font = this._buildFont();
    ctx.fillStyle = this.fill;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.stroke && this.strokeWidth) {
      ctx.strokeStyle = this.stroke;
      ctx.lineWidth = this.strokeWidth;
      ctx.strokeText(this.text, 0, 0);
    }
    ctx.fillText(this.text, 0, 0);

    ctx.restore();
  }

  /**
   * Render text with actual path warping using opentype.js
   * Each point in the glyph path is transformed to follow the curve
   */
  private _renderWarpedPath(ctx: CanvasRenderingContext2D): void {
    const font = this._loadedFont;
    if (!font || !this.text) return;

    ctx.save();

    const intensity = this.curveIntensity / 100;
    const absIntensity = Math.abs(intensity);

    // Arc angle: 0% = 0°, 100% = 360° (full circle)
    const arcAngle = 2 * Math.PI * absIntensity;

    if (arcAngle < 0.01) {
      this._renderStraight(ctx);
      ctx.restore();
      return;
    }

    // Get text metrics
    const scale = this.fontSize / font.unitsPerEm;
    const spacing = (this.charSpacing || 0) / 1000 * this.fontSize;

    // Calculate total text width
    let totalWidth = 0;
    for (let i = 0; i < this.text.length; i++) {
      const glyph = font.charToGlyph(this.text[i]);
      totalWidth += (glyph.advanceWidth || 0) * scale;
      if (i < this.text.length - 1) {
        totalWidth += spacing;
      }
    }

    // Calculate radius from arc length
    const radius = totalWidth / arcAngle;

    // Center angle for the text
    const centerAngle = intensity < 0 ? -Math.PI / 2 : Math.PI / 2;
    const startAngle = centerAngle - arcAngle / 2;

    // Sagitta for vertical centering
    const sagitta = radius * (1 - Math.cos(arcAngle / 2));
    const offsetY = intensity < 0
      ? radius - sagitta / 2
      : -radius + sagitta / 2;

    // Build the warped path
    ctx.beginPath();

    let currentX = 0; // Current position along the baseline

    for (let i = 0; i < this.text.length; i++) {
      const char = this.text[i];
      const glyph = font.charToGlyph(char);
      const glyphPath = glyph.getPath(0, 0, this.fontSize);

      // Transform each command in the glyph path
      for (const cmd of glyphPath.commands) {
        if (cmd.type === 'M') {
          const p = this._warpPoint(cmd.x!, cmd.y!, currentX, totalWidth, radius, startAngle, arcAngle, offsetY, intensity);
          ctx.moveTo(p.x, p.y);
        } else if (cmd.type === 'L') {
          const p = this._warpPoint(cmd.x!, cmd.y!, currentX, totalWidth, radius, startAngle, arcAngle, offsetY, intensity);
          ctx.lineTo(p.x, p.y);
        } else if (cmd.type === 'C') {
          const p1 = this._warpPoint(cmd.x1!, cmd.y1!, currentX, totalWidth, radius, startAngle, arcAngle, offsetY, intensity);
          const p2 = this._warpPoint(cmd.x2!, cmd.y2!, currentX, totalWidth, radius, startAngle, arcAngle, offsetY, intensity);
          const p = this._warpPoint(cmd.x!, cmd.y!, currentX, totalWidth, radius, startAngle, arcAngle, offsetY, intensity);
          ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p.x, p.y);
        } else if (cmd.type === 'Q') {
          const p1 = this._warpPoint(cmd.x1!, cmd.y1!, currentX, totalWidth, radius, startAngle, arcAngle, offsetY, intensity);
          const p = this._warpPoint(cmd.x!, cmd.y!, currentX, totalWidth, radius, startAngle, arcAngle, offsetY, intensity);
          ctx.quadraticCurveTo(p1.x, p1.y, p.x, p.y);
        } else if (cmd.type === 'Z') {
          ctx.closePath();
        }
      }

      // Advance position for next character
      currentX += (glyph.advanceWidth || 0) * scale + spacing;
    }

    // Fill and stroke
    ctx.fillStyle = this.fill;
    ctx.fill();

    if (this.stroke && this.strokeWidth) {
      ctx.strokeStyle = this.stroke;
      ctx.lineWidth = this.strokeWidth;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Transform a point from flat coordinates to curved coordinates
   */
  private _warpPoint(
    x: number,
    y: number,
    charOffset: number,
    totalWidth: number,
    radius: number,
    startAngle: number,
    arcAngle: number,
    offsetY: number,
    intensity: number
  ): { x: number; y: number } {
    // x is position along the text (0 to totalWidth)
    // y is vertical position (baseline at ~fontSize, up is negative in glyph coords)

    // Convert glyph y to distance from baseline (opentype has y going up)
    // In glyph coordinates, baseline is at y=0, ascender goes positive
    const baselineOffset = this.fontSize * 0.75; // Approximate baseline position
    const distFromBaseline = -(y - baselineOffset); // Flip and offset

    // Position along the arc (0 to 1)
    const globalX = charOffset + x;
    const t = globalX / totalWidth;

    // Angle at this position
    const angle = startAngle + arcAngle * t;

    // Radius adjusted by vertical position
    // For upward curve (intensity < 0): text on bottom of circle, inside is toward center
    // For downward curve (intensity > 0): text on top of circle, inside is toward center
    const adjustedRadius = intensity < 0
      ? radius + distFromBaseline
      : radius - distFromBaseline;

    // Calculate position on the curved path
    const newX = Math.cos(angle) * adjustedRadius;
    const newY = Math.sin(angle) * adjustedRadius + offsetY;

    return { x: newX, y: newY };
  }

  /**
   * Fallback: Render text along a curve using rotation (when font not loaded)
   */
  private _renderCurvedFallback(ctx: CanvasRenderingContext2D): void {
    const text = this.text;
    if (!text) return;

    ctx.save();

    ctx.font = this._buildFont();
    ctx.fillStyle = this.fill;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.stroke && this.strokeWidth) {
      ctx.strokeStyle = this.stroke;
      ctx.lineWidth = this.strokeWidth;
    }

    // Measure characters
    const chars = text.split('');
    const charWidths = chars.map(c => ctx.measureText(c).width);
    const spacing = (this.charSpacing || 0) / 1000 * this.fontSize;
    const totalTextWidth = charWidths.reduce((sum, w) => sum + w, 0) + spacing * Math.max(0, chars.length - 1);

    const intensity = this.curveIntensity / 100;
    const absIntensity = Math.abs(intensity);

    const arcAngle = 2 * Math.PI * absIntensity;

    if (arcAngle < 0.01) {
      this._renderStraight(ctx);
      ctx.restore();
      return;
    }

    const radius = totalTextWidth / arcAngle;

    const startAngle = intensity < 0
      ? -Math.PI / 2 - arcAngle / 2
      : Math.PI / 2 - arcAngle / 2;

    const sagitta = radius * (1 - Math.cos(arcAngle / 2));

    const offsetY = intensity < 0
      ? radius - sagitta / 2
      : -radius + sagitta / 2;

    let currentArcPos = 0;

    chars.forEach((char, i) => {
      const charW = charWidths[i];
      const charArcPos = currentArcPos + charW / 2;

      const t = charArcPos / totalTextWidth;
      const angle = startAngle + arcAngle * t;

      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius + offsetY;

      const rotation = intensity < 0
        ? angle + Math.PI / 2
        : angle - Math.PI / 2;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);

      if (this.stroke && this.strokeWidth) {
        ctx.strokeText(char, 0, 0);
      }
      ctx.fillText(char, 0, 0);

      ctx.restore();

      currentArcPos += charW + spacing;
    });

    ctx.restore();
  }

  /**
   * Build CSS font string
   */
  private _buildFont(): string {
    return `${this.fontStyle} ${this.fontWeight} ${this.fontSize}px "${this.fontFamily}"`;
  }

  /**
   * Set curve intensity
   */
  setCurve(intensity: number): void {
    this.curveIntensity = Math.max(-100, Math.min(100, intensity));
    this._updateBoundsForCurve();
    this.dirty = true;
    this.setCoords();
    this.canvas?.requestRenderAll();
  }

  /**
   * Set text content and update bounds
   */
  setText(text: string): void {
    this.text = text;
    this._updateBoundsForText();
    this._updateBoundsForCurve();
    this.dirty = true;
    this.setCoords();
    this.canvas?.requestRenderAll();
  }

  /**
   * Update width based on text content
   */
  private _updateBoundsForText(): void {
    // Create temporary canvas to measure text
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    ctx.font = this._buildFont();
    const metrics = ctx.measureText(this.text);
    const textWidth = metrics.width;

    // Width: use actual text width
    this.width = Math.max(textWidth, 10);
  }

  /**
   * Set font and reload
   */
  setFont(fontFamily: string, fontUrl?: string): void {
    this.fontFamily = fontFamily;
    this.fontUrl = fontUrl || '';
    this._loadedFont = null;
    this._loadFont();
    this._updateBoundsForText();
    this.dirty = true;
    this.canvas?.requestRenderAll();
  }

  /**
   * Set font size and update bounds
   */
  setFontSize(size: number): void {
    this.fontSize = size;
    this._updateBoundsForText();
    this._updateBoundsForCurve();
    this.dirty = true;
    this.setCoords();
    this.canvas?.requestRenderAll();
  }

  /**
   * Set character spacing and update bounds
   */
  setCharSpacing(spacing: number): void {
    this.charSpacing = spacing;
    this._updateBoundsForText();
    this._updateBoundsForCurve();
    this.dirty = true;
    this.setCoords();
    this.canvas?.requestRenderAll();
  }

  /**
   * Set fill color and update display
   */
  setFill(color: string): void {
    this.fill = color;
    this.dirty = true;
    this.canvas?.requestRenderAll();
  }

  /**
   * Set font weight and update bounds
   */
  setFontWeight(weight: string): void {
    this.fontWeight = weight;
    this._updateBoundsForText();
    this._updateBoundsForCurve();
    this.dirty = true;
    this.setCoords();
    this.canvas?.requestRenderAll();
  }

  /**
   * Set font style and update bounds
   */
  setFontStyle(style: string): void {
    this.fontStyle = style;
    this._updateBoundsForText();
    this._updateBoundsForCurve();
    this.dirty = true;
    this.setCoords();
    this.canvas?.requestRenderAll();
  }

  /**
   * Public method to recalculate bounds after property changes
   * Call this after modifying properties that affect text dimensions
   */
  updateBounds(): void {
    this._updateBoundsForText();
    this._updateBoundsForCurve();
    this.dirty = true;
    this.setCoords();
    this.canvas?.requestRenderAll();
  }

  /**
   * Enter editing mode - show textarea overlay
   */
  enterEditing(): void {
    if (this._isEditing || !this.canvas) return;
    this._isEditing = true;

    const canvas = this.canvas as fabric.Canvas;
    const canvasEl = canvas.getElement();
    const container = canvasEl.parentElement;
    if (!container) return;

    // Get object's screen position
    const zoom = canvas.getZoom();
    const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
    const objCenter = this.getCenterPoint();
    const screenX = objCenter.x * zoom + vpt[4];
    const screenY = objCenter.y * zoom + vpt[5];

    // Create textarea
    const textarea = document.createElement('textarea');
    textarea.value = this.text;
    textarea.style.cssText = `
      position: absolute;
      left: ${screenX - (this.width! * zoom) / 2}px;
      top: ${screenY - (this.height! * zoom) / 2}px;
      width: ${this.width! * zoom}px;
      height: ${this.height! * zoom}px;
      font-family: ${this.fontFamily};
      font-size: ${this.fontSize * zoom}px;
      font-weight: ${this.fontWeight};
      font-style: ${this.fontStyle};
      color: ${this.fill};
      text-align: center;
      border: 2px solid #007bff;
      border-radius: 4px;
      padding: 8px;
      box-sizing: border-box;
      resize: none;
      outline: none;
      background: white;
      z-index: 1000;
    `;

    textarea.addEventListener('blur', () => this.exitEditing());
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.exitEditing();
      }
    });

    container.appendChild(textarea);
    textarea.focus();
    textarea.select();

    this._editingTextarea = textarea;
    this.dirty = true;
    canvas.requestRenderAll();
  }

  /**
   * Exit editing mode
   */
  exitEditing(): void {
    if (!this._isEditing || !this._editingTextarea) return;

    // Get the text from textarea
    this.text = this._editingTextarea.value;

    // Remove textarea
    this._editingTextarea.remove();
    this._editingTextarea = null;
    this._isEditing = false;

    this.dirty = true;
    this.canvas?.requestRenderAll();
  }

  /**
   * Check if currently editing
   */
  get isEditing(): boolean {
    return this._isEditing;
  }

  /**
   * Generate SVG representation of the curved text
   * This is required for proper SVG export
   */
  toSVG(): string {
    const left = this.left || 0;
    const top = this.top || 0;
    const angle = this.angle || 0;
    const scaleX = this.scaleX || 1;
    const scaleY = this.scaleY || 1;
    const opacity = this.opacity ?? 1;

    // Build transform attribute
    const transforms: string[] = [];
    transforms.push(`translate(${left}, ${top})`);
    if (angle !== 0) {
      transforms.push(`rotate(${angle})`);
    }
    if (scaleX !== 1 || scaleY !== 1) {
      transforms.push(`scale(${scaleX}, ${scaleY})`);
    }
    const transformAttr = transforms.length > 0 ? ` transform="${transforms.join(' ')}"` : '';

    // For straight text, render as text element
    if (this.curveIntensity === 0) {
      const escapedText = this._escapeXml(this.text);
      return `<g${transformAttr}>
  <text x="0" y="0"
    font-family="${this._escapeXml(this.fontFamily)}"
    font-size="${this.fontSize}"
    font-weight="${this.fontWeight}"
    font-style="${this.fontStyle}"
    fill="${this._escapeXml(this.fill)}"
    text-anchor="middle"
    dominant-baseline="middle"
    opacity="${opacity}"
    ${this.stroke ? `stroke="${this._escapeXml(this.stroke)}" stroke-width="${this.strokeWidth}"` : ''}
  >${escapedText}</text>
</g>`;
    }

    // For curved text, generate path data
    const pathData = this._generateSVGPathData();
    if (!pathData) {
      // Fallback to straight text if path generation fails
      const escapedText = this._escapeXml(this.text);
      return `<g${transformAttr}>
  <text x="0" y="0"
    font-family="${this._escapeXml(this.fontFamily)}"
    font-size="${this.fontSize}"
    fill="${this._escapeXml(this.fill)}"
    text-anchor="middle"
    dominant-baseline="middle"
    opacity="${opacity}"
  >${escapedText}</text>
</g>`;
    }

    return `<g${transformAttr}>
  <path d="${pathData}"
    fill="${this._escapeXml(this.fill)}"
    opacity="${opacity}"
    ${this.stroke ? `stroke="${this._escapeXml(this.stroke)}" stroke-width="${this.strokeWidth}"` : ''}
  />
</g>`;
  }

  /**
   * Generate SVG path data for the warped text
   */
  private _generateSVGPathData(): string | null {
    const font = this._loadedFont;
    if (!font || !this.text) return null;

    const intensity = this.curveIntensity / 100;
    const absIntensity = Math.abs(intensity);
    const arcAngle = 2 * Math.PI * absIntensity;

    if (arcAngle < 0.01) return null;

    // Get text metrics
    const scale = this.fontSize / font.unitsPerEm;
    const spacing = (this.charSpacing || 0) / 1000 * this.fontSize;

    // Calculate total text width
    let totalWidth = 0;
    for (let i = 0; i < this.text.length; i++) {
      const glyph = font.charToGlyph(this.text[i]);
      totalWidth += (glyph.advanceWidth || 0) * scale;
      if (i < this.text.length - 1) {
        totalWidth += spacing;
      }
    }

    const radius = totalWidth / arcAngle;
    const centerAngle = intensity < 0 ? -Math.PI / 2 : Math.PI / 2;
    const startAngle = centerAngle - arcAngle / 2;
    const sagitta = radius * (1 - Math.cos(arcAngle / 2));
    const offsetY = intensity < 0
      ? radius - sagitta / 2
      : -radius + sagitta / 2;

    // Build SVG path commands
    const pathCommands: string[] = [];
    let currentX = 0;

    for (let i = 0; i < this.text.length; i++) {
      const char = this.text[i];
      const glyph = font.charToGlyph(char);
      const glyphPath = glyph.getPath(0, 0, this.fontSize);

      for (const cmd of glyphPath.commands) {
        if (cmd.type === 'M') {
          const p = this._warpPoint(cmd.x!, cmd.y!, currentX, totalWidth, radius, startAngle, arcAngle, offsetY, intensity);
          pathCommands.push(`M ${this._formatNum(p.x)} ${this._formatNum(p.y)}`);
        } else if (cmd.type === 'L') {
          const p = this._warpPoint(cmd.x!, cmd.y!, currentX, totalWidth, radius, startAngle, arcAngle, offsetY, intensity);
          pathCommands.push(`L ${this._formatNum(p.x)} ${this._formatNum(p.y)}`);
        } else if (cmd.type === 'C') {
          const p1 = this._warpPoint(cmd.x1!, cmd.y1!, currentX, totalWidth, radius, startAngle, arcAngle, offsetY, intensity);
          const p2 = this._warpPoint(cmd.x2!, cmd.y2!, currentX, totalWidth, radius, startAngle, arcAngle, offsetY, intensity);
          const p = this._warpPoint(cmd.x!, cmd.y!, currentX, totalWidth, radius, startAngle, arcAngle, offsetY, intensity);
          pathCommands.push(`C ${this._formatNum(p1.x)} ${this._formatNum(p1.y)} ${this._formatNum(p2.x)} ${this._formatNum(p2.y)} ${this._formatNum(p.x)} ${this._formatNum(p.y)}`);
        } else if (cmd.type === 'Q') {
          const p1 = this._warpPoint(cmd.x1!, cmd.y1!, currentX, totalWidth, radius, startAngle, arcAngle, offsetY, intensity);
          const p = this._warpPoint(cmd.x!, cmd.y!, currentX, totalWidth, radius, startAngle, arcAngle, offsetY, intensity);
          pathCommands.push(`Q ${this._formatNum(p1.x)} ${this._formatNum(p1.y)} ${this._formatNum(p.x)} ${this._formatNum(p.y)}`);
        } else if (cmd.type === 'Z') {
          pathCommands.push('Z');
        }
      }

      currentX += (glyph.advanceWidth || 0) * scale + spacing;
    }

    return pathCommands.join(' ');
  }

  /**
   * Format number for SVG (avoid scientific notation, limit decimals)
   */
  private _formatNum(n: number): string {
    return Number(n.toFixed(4)).toString();
  }

  /**
   * Escape XML special characters
   */
  private _escapeXml(text: string): string {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Serialize
   */
  toObject(propertiesToInclude: string[] = []): Record<string, unknown> {
    // Pre-compute SVG path data for server-side export
    // This allows the server to generate SVG without needing opentype.js
    const svgPathData = this._generateSVGPathData();

    return {
      ...super.toObject(propertiesToInclude),
      type: 'CurvedText',
      text: this.text,
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      fontWeight: this.fontWeight,
      fontStyle: this.fontStyle,
      fill: this.fill,
      stroke: this.stroke,
      strokeWidth: this.strokeWidth,
      charSpacing: this.charSpacing,
      curveIntensity: this.curveIntensity,
      fontUrl: this.fontUrl,
      // Pre-computed SVG path data for server-side rendering
      svgPathData: svgPathData || undefined,
    };
  }

  /**
   * Deserialize from object (required for fabric.js to restore saved objects)
   */
  static fromObject(object: Record<string, unknown>): Promise<CurvedText> {
    return Promise.resolve(new CurvedText({
      left: object.left as number,
      top: object.top as number,
      width: object.width as number,
      height: object.height as number,
      text: object.text as string,
      fontSize: object.fontSize as number,
      fontFamily: object.fontFamily as string,
      fontWeight: object.fontWeight as string,
      fontStyle: object.fontStyle as string,
      fill: object.fill as string,
      stroke: object.stroke as string,
      strokeWidth: object.strokeWidth as number,
      charSpacing: object.charSpacing as number,
      curveIntensity: object.curveIntensity as number,
      opacity: object.opacity as number,
      angle: object.angle as number,
      fontUrl: object.fontUrl as string,
      scaleX: object.scaleX as number,
      scaleY: object.scaleY as number,
      // Mark as restored from saved state to skip bounds recalculation
      _fromSavedState: true,
    }));
  }
}

// Register with fabric.js class registry
fabric.classRegistry.setClass(CurvedText);
fabric.classRegistry.setClass(CurvedText, 'CurvedText');

/**
 * Check if object is a CurvedText
 */
export function isCurvedText(obj: fabric.FabricObject): obj is CurvedText {
  return obj instanceof CurvedText;
}

/**
 * Create a CurvedText from a regular text object
 */
export function createCurvedTextFromText(
  source: fabric.IText | fabric.Text,
  curveIntensity: number = 0,
  fontUrl?: string
): CurvedText {
  // Measure text to get appropriate dimensions
  const tempCanvas = document.createElement('canvas');
  const ctx = tempCanvas.getContext('2d')!;
  const fontSize = source.fontSize || 40;
  ctx.font = `${source.fontStyle || 'normal'} ${source.fontWeight || 'normal'} ${fontSize}px "${source.fontFamily || 'Arial'}"`;
  const metrics = ctx.measureText(source.text || 'Text');
  const textWidth = metrics.width;

  // Width: use actual text width
  const width = Math.max(textWidth, 10);

  // Height: for curved text, make it square-ish to fit circular arcs
  // For slight curves, height is smaller; for full circles, height = width
  const absIntensity = Math.abs(curveIntensity) / 100;
  const baseHeight = fontSize * 1.2;
  const curveHeight = absIntensity > 0.5 ? width : baseHeight + (width - baseHeight) * absIntensity;
  const height = Math.max(curveHeight, baseHeight);

  // Get the center point of the original text object to maintain position
  // CurvedText renders from center, so we need to calculate proper left/top
  const sourceCenter = source.getCenterPoint();
  const scaleX = source.scaleX || 1;
  const scaleY = source.scaleY || 1;

  return new CurvedText({
    left: sourceCenter.x,
    top: sourceCenter.y,
    originX: 'center',
    originY: 'center',
    width,
    height,
    text: source.text || 'Text',
    fontSize: fontSize as number,
    fontFamily: source.fontFamily as string,
    fontWeight: source.fontWeight as string,
    fontStyle: source.fontStyle as string,
    fill: source.fill as string,
    stroke: source.stroke as string,
    strokeWidth: source.strokeWidth,
    charSpacing: source.charSpacing,
    curveIntensity,
    opacity: source.opacity,
    angle: source.angle,
    scaleX,
    scaleY,
    fontUrl,
  });
}

/**
 * Convert existing text to CurvedText on canvas
 */
export function convertToCurvedText(
  textObj: fabric.IText | fabric.Text,
  curveIntensity: number,
  fontUrl?: string
): CurvedText {
  const canvas = textObj.canvas;
  const curved = createCurvedTextFromText(textObj, curveIntensity, fontUrl);

  if (canvas) {
    canvas.remove(textObj);
    canvas.add(curved);
    canvas.setActiveObject(curved);
    canvas.requestRenderAll();
  }

  return curved;
}

/**
 * Add double-click handler for editing
 */
export function setupCurvedTextEditing(canvas: fabric.Canvas): void {
  canvas.on('mouse:dblclick', (e) => {
    if (e.target && isCurvedText(e.target)) {
      e.target.enterEditing();
    }
  });
}
