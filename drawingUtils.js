import * as config from './config.js';

// --- Simple PRNG (LCG) ---
// Creates a seeded random number generator
function createPRNG(seed) {
    let state = seed % 2147483647; // Ensure state is within 32-bit signed integer range
    if (state <= 0) state += 2147483646;
    return {
        next: function() {
            state = (state * 16807) % 2147483647;
            return (state - 1) / 2147483646; // Return a value between 0 (inclusive) and 1 (exclusive)
        }
    };
}

// --- Drawing Functions ---

export function drawColorTile(ctx, x, y, size, tileDef) {
    ctx.fillStyle = tileDef.color;
    ctx.fillRect(x, y, size, size);
}

// Use PRNG for Noise
export function drawNoiseTile(ctx, x, y, size, tileDef) {
    const baseColor = tileDef.color1;
    const noiseColor = tileDef.color2;
    const density = tileDef.density || 0.3;
    const numDots = Math.floor(size * size * density);

    // Base color
    ctx.fillStyle = baseColor;
    ctx.fillRect(x, y, size, size);

    // Noise dots using PRNG seeded by coordinates
    const seed = Math.floor(x * 13 + y * 31); // Simple seeding based on position
    const rng = createPRNG(seed);

    ctx.fillStyle = noiseColor;
    const scaleX = ctx.getTransform().a;
    const scaleY = ctx.getTransform().d;
    // Ensure dot size isn't zero if scale is extremely large
    const dotSizeX = Math.max(0.1, 1 / scaleX);
    const dotSizeY = Math.max(0.1, 1 / scaleY);


    for (let i = 0; i < numDots; i++) {
        // Use the PRNG instead of Math.random()
        const dotX = x + rng.next() * size;
        const dotY = y + rng.next() * size;
        // Center the 'pixel' for potentially better appearance
        ctx.fillRect(dotX - dotSizeX / 2, dotY - dotSizeY / 2, dotSizeX, dotSizeY);
    }
}

// Simple patterns
export function drawPatternTile(ctx, x, y, size, tileDef) {
    const color1 = tileDef.color1;
    const color2 = tileDef.color2;
    const scale = ctx.getTransform().a; // Use 'a' for horizontal scale assuming no skew
    // Ensure minimum line width but prevent it becoming too large at low zoom
    const lineWidth = Math.max(0.5 / scale, 0.1); // Use 0.5 as base, ensure min 0.1

    ctx.fillStyle = color1; // Base color
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = color2;
    ctx.fillStyle = color2; // For filled patterns like bricks/rails
    ctx.lineWidth = lineWidth;


    switch (tileDef.pattern) {
        case 'waves':
            const waveHeight = size * 0.15;
            const waveLength = size * 0.5;
            ctx.beginPath();
            for (let wy = y + waveHeight; wy < y + size - waveHeight / 2; wy += waveHeight * 2) {
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
             for (let i = 1; i < numLinesH; i++) { // Start from 1 to avoid drawing on edge
                 const ly = Math.round(y + i * spacingH); // Round to nearest pixel?
                 ctx.moveTo(x, ly);
                 ctx.lineTo(x + size, ly);
             }
             ctx.stroke();
             break;
         case 'checker':
             const step = size / 4; // Example checker size
             for(let ix = 0; ix < 4; ix++) {
                 for(let iy = 0; iy < 4; iy++) {
                     if((ix + iy) % 2 === 0) { // Checkered pattern logic
                         // Use fillRect that snaps to pixels if needed? For now, standard fillRect.
                         ctx.fillRect(x + ix * step, y + iy * step, step, step);
                     }
                 }
             }
             break;
        case 'rail': // Rail Pattern
            const tieWidth = size * 0.8;
            const tieHeight = size * 0.1;
            const railWidth = size * 0.08;
            const railSpacing = size * 0.5; // Spacing between centerlines of rails
            const numTies = 4; // Example number of ties
            const tieSpacing = size / numTies;

            // Ties (horizontal rects) - Drawn first
            ctx.fillStyle = color1; // Use base color (often wood/dirt) for ties
            for (let i = 0; i < numTies; i++) {
                const tieY = y + i * tieSpacing + (tieSpacing - tieHeight) / 2;
                 ctx.fillRect(x + (size - tieWidth) / 2, tieY, tieWidth, tieHeight);
            }
            // Rails (vertical rects) - Drawn second, on top of ties
            ctx.fillStyle = color2; // Use pattern color (often gray/metal) for rails
            const railOffset = (size - railSpacing) / 2;
            ctx.fillRect(x + railOffset, y, railWidth, size); // Left rail
            ctx.fillRect(x + railOffset + railSpacing - railWidth, y, railWidth, size); // Right rail
            break;
         case 'bricks': // Brick Pattern
             const numRows = 4;
             const numCols = 2; // Bricks per row (visually)
             const brickHeight = size / numRows;
             const brickWidth = size / numCols;
             ctx.strokeStyle = color1; // Mortar color (base) - used for lines
             ctx.fillStyle = color2;   // Brick color (pattern) - used for fill
             ctx.beginPath(); // Start path for all mortar lines

             for (let row = 0; row < numRows; row++) {
                 const offsetY = (row % 2 === 0) ? 0 : -brickWidth / 2; // Offset every other row
                 for (let col = -1; col <= numCols; col++) { // Draw potentially partial bricks at edges
                     const brickX = x + col * brickWidth + offsetY;
                     const brickY = y + row * brickHeight;

                     // Clip drawing to the tile bounds precisely
                     ctx.save();
                     ctx.beginPath(); // New path for clipping
                     ctx.rect(x, y, size, size);
                     ctx.clip();

                     // Draw the brick fill (adjust slightly for line width visibility)
                     ctx.fillRect(brickX + lineWidth/2, brickY + lineWidth/2, brickWidth - lineWidth, brickHeight - lineWidth);

                     ctx.restore(); // Restore context to remove clipping for next brick/lines
                 }
                 // Add horizontal mortar line path
                  if (row > 0) {
                      const lineY = y + row * brickHeight;
                      ctx.moveTo(x, lineY);
                      ctx.lineTo(x + size, lineY);
                  }
             }
              // Add vertical mortar line paths (staggered)
             for (let row = 0; row < numRows; row++) {
                 const offsetY = (row % 2 === 0) ? 0 : brickWidth / 2; // Reverse offset for lines
                 for (let col = 0; col <= numCols; col++) {
                      const lineX = x + col * brickWidth - offsetY;
                     if (lineX > x && lineX < x + size) { // Only draw lines within the tile bounds
                         ctx.moveTo(lineX, y + row * brickHeight);
                         ctx.lineTo(lineX, y + row * brickHeight + brickHeight);
                     }
                 }
             }
             // Stroke all mortar lines at once
             ctx.stroke();
             break;

        default: // Fallback to just drawing base color if pattern unknown
            ctx.fillStyle = color1;
            ctx.fillRect(x,y,size,size);
            console.warn(`Unknown pattern type: ${tileDef.pattern}`);
            break;
    }
}

// Dispatcher function
export function drawGeneratedTile(ctx, x, y, size, tileId) {
    const tileDef = config.GENERATED_TILES[tileId];
    if (!tileDef) {
        console.error(`Definition not found for generated tile: ${tileId}`);
        // Draw a fallback placeholder (e.g., magenta square)
        ctx.fillStyle = '#FF00FF';
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = '#000000';
        ctx.font = `${size * 0.5}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', x + size / 2, y + size / 2);
        return;
    }

    // Save context state before drawing complex patterns
    ctx.save();
    try { // Use try/finally to ensure context is restored
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
            default:
                console.warn(`Unknown generated tile type: ${tileDef.type}`);
                 // Fallback placeholder if type is wrong
                ctx.fillStyle = '#FF00FF';
                ctx.fillRect(x, y, size, size);
                break;
        }
    } finally {
        ctx.restore(); // Restore context state (fill, stroke, line width, clip)
    }
}
