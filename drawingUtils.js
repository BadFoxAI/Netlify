import * as config from './config.js'; // <<<--- Added Import

// --- Drawing Functions for Generated Tiles ---

// Simple solid color
export function drawColorTile(ctx, x, y, size, tileDef) {
    ctx.fillStyle = tileDef.color;
    ctx.fillRect(x, y, size, size);
}

// Basic noise/stipple effect
export function drawNoiseTile(ctx, x, y, size, tileDef) {
    const baseColor = tileDef.color1;
    const noiseColor = tileDef.color2;
    const density = tileDef.density || 0.3;
    const numDots = Math.floor(size * size * density);

    // Base color
    ctx.fillStyle = baseColor;
    ctx.fillRect(x, y, size, size);

    // Noise dots
    ctx.fillStyle = noiseColor;
    // Adjust dot size based on current transform scale to aim for ~1 pixel
    const scaleX = ctx.getTransform().a; // Assumes no skew/rotation
    const scaleY = ctx.getTransform().d;
    const dotSizeX = 1 / scaleX;
    const dotSizeY = 1 / scaleY;

    for (let i = 0; i < numDots; i++) {
        const dotX = x + Math.random() * size;
        const dotY = y + Math.random() * size;
        ctx.fillRect(dotX - dotSizeX / 2, dotY - dotSizeY / 2, dotSizeX, dotSizeY); // Center the 'pixel'
    }
}


// Simple patterns
export function drawPatternTile(ctx, x, y, size, tileDef) {
    const color1 = tileDef.color1;
    const color2 = tileDef.color2;
     // Adjust line width based on current transform scale
    const scaleX = ctx.getTransform().a;
    const lineWidth = Math.max(1 / scaleX, 0.5); // Ensure minimum visible line width


    ctx.fillStyle = color1;
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = color2;
    ctx.lineWidth = lineWidth;


    switch (tileDef.pattern) {
        case 'waves':
            const waveHeight = size * 0.15;
            const waveLength = size * 0.5;
            ctx.beginPath();
            for (let wy = y + waveHeight * 1.5; wy < y + size; wy += waveHeight * 2) {
                ctx.moveTo(x, wy);
                for (let wx = x; wx < x + size; wx += waveLength) {
                    ctx.quadraticCurveTo(wx + waveLength / 4, wy + waveHeight, wx + waveLength / 2, wy);
                    ctx.quadraticCurveTo(wx + (waveLength * 3 / 4), wy - waveHeight, wx + waveLength, wy);
                }
            }
            ctx.stroke();
            break;
        case 'lines_h': // Horizontal Lines
             const numLinesH = 5; // Example: 5 lines
             const spacingH = size / numLinesH;
             ctx.beginPath();
             for (let i = 1; i < numLinesH; i++) {
                 const ly = y + i * spacingH;
                 ctx.moveTo(x, ly);
                 ctx.lineTo(x + size, ly);
             }
             ctx.stroke();
             break;
         case 'checker':
             ctx.fillStyle = color2;
             const step = size / 4; // Example checker size
             for(let ix = 0; ix < 4; ix++) {
                 for(let iy = 0; iy < 4; iy++) {
                     if((ix + iy) % 2 === 0) {
                         ctx.fillRect(x + ix * step, y + iy * step, step, step);
                     }
                 }
             }
             break;
        default:
            break;
    }
}

// Dispatcher function
export function drawGeneratedTile(ctx, x, y, size, tileId) {
    const tileDef = config.GENERATED_TILES[tileId];
    if (!tileDef) return; // Unknown generated tile

    // Store current fill/stroke to restore later if needed, though drawing funcs set their own
    // const originalFill = ctx.fillStyle;
    // const originalStroke = ctx.strokeStyle;
    // const originalLineWidth = ctx.lineWidth;

    switch (tileDef.type) {
        case 'color':
            drawColorTile(ctx, x, y, size, tileDef);
            break;
        case 'noise':
            drawNoiseTile(ctx, x, y, size, tileDef);
            break;
        case 'pattern':
            drawPatternTile(ctx, x, y, size, tileDef);
            break;
    }

    // Restore if needed
    // ctx.fillStyle = originalFill;
    // ctx.strokeStyle = originalStroke;
    // ctx.lineWidth = originalLineWidth;
}
