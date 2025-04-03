import * as config from './config.js';

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
        // Center the 'pixel' for potentially better appearance
        ctx.fillRect(dotX - dotSizeX / 2, dotY - dotSizeY / 2, dotSizeX, dotSizeY);
    }
}


// Simple patterns
export function drawPatternTile(ctx, x, y, size, tileDef) {
    const color1 = tileDef.color1;
    const color2 = tileDef.color2;
    // Adjust line width based on current transform scale
    const scale = ctx.getTransform().a; // Use 'a' for horizontal scale assuming no skew
    const lineWidth = Math.max(1 / scale, 0.5); // Ensure minimum visible line width

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
            // Start waves slightly offset for better look
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
                 const ly = y + i * spacingH;
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

             for (let row = 0; row < numRows; row++) {
                 const offsetY = (row % 2 === 0) ? 0 : -brickWidth / 2; // Offset every other row
                 for (let col = -1; col <= numCols; col++) { // Draw potentially partial bricks at edges
                     const brickX = x + col * brickWidth + offsetY;
                     const brickY = y + row * brickHeight;

                     // Clip drawing to the tile bounds precisely
                     ctx.save(); // Save context before clipping
                     ctx.beginPath();
                     ctx.rect(x, y, size, size);
                     ctx.clip();

                     // Draw the brick (fill first, then stroke for mortar lines)
                     // Subtract lineWidth * 2 from width/height for fill to keep lines visible
                     const drawWidth = brickWidth - lineWidth ;
                     const drawHeight = brickHeight - lineWidth;
                     ctx.fillRect(brickX + lineWidth/2, brickY + lineWidth/2, drawWidth, drawHeight);
                     // ctx.strokeRect(brickX + lineWidth/2, brickY + lineWidth/2, drawWidth, drawHeight); // Optional: stroke can make it look less clean

                     ctx.restore(); // Restore context to remove clipping for next brick
                 }
             }
             // Draw outer border for the tile itself (optional, can help definition)
             // ctx.strokeStyle = color1; // Mortar color
             // ctx.strokeRect(x + lineWidth / 2, y + lineWidth / 2, size - lineWidth, size - lineWidth);
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
