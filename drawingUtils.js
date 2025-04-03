import * as config from './config.js';

// --- Drawing Functions for Generated Tiles ---

export function drawColorTile(ctx, x, y, size, tileDef) { /* ... Unchanged ... */
    ctx.fillStyle = tileDef.color;
    ctx.fillRect(x, y, size, size);
}
export function drawNoiseTile(ctx, x, y, size, tileDef) { /* ... Unchanged ... */
    const baseColor = tileDef.color1; const noiseColor = tileDef.color2; const density = tileDef.density || 0.3; const numDots = Math.floor(size*size*density);
    ctx.fillStyle = baseColor; ctx.fillRect(x, y, size, size); ctx.fillStyle = noiseColor; const scaleX = ctx.getTransform().a; const scaleY = ctx.getTransform().d; const dotSizeX = 1 / scaleX; const dotSizeY = 1 / scaleY;
    for(let i=0; i<numDots; i++){ const dX=x+Math.random()*size; const dY=y+Math.random()*size; ctx.fillRect(dX-dotSizeX/2, dY-dotSizeY/2, dotSizeX, dotSizeY); }
}

export function drawPatternTile(ctx, x, y, size, tileDef) {
    const color1 = tileDef.color1;
    const color2 = tileDef.color2;
    const scale = ctx.getTransform().a; // Use 'a' for horizontal scale assuming no skew
    const lineWidth = Math.max(1 / scale, 0.5);

    ctx.fillStyle = color1; // Base color
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = color2;
    ctx.fillStyle = color2; // For filled patterns like bricks
    ctx.lineWidth = lineWidth;

    switch (tileDef.pattern) {
        case 'waves': /* ... Unchanged ... */
             const wH = size * 0.15; const wL = size * 0.5; ctx.beginPath();
             for(let wy=y+wH*1.5; wy<y+size; wy+=wH*2){ ctx.moveTo(x,wy); for(let wx=x; wx<x+size; wx+=wL){ ctx.quadraticCurveTo(wx+wL/4,wy+wH,wx+wL/2,wy); ctx.quadraticCurveTo(wx+(wL*3/4),wy-wH,wx+wL,wy); } } ctx.stroke();
             break;
        case 'lines_h': /* ... Unchanged ... */
             const nLH=5; const sH=size/nLH; ctx.beginPath(); for(let i=1; i<nLH; i++){const ly=y+i*sH; ctx.moveTo(x,ly);ctx.lineTo(x+size,ly);} ctx.stroke();
             break;
        case 'checker': /* ... Unchanged ... */
             const st=size/4; for(let ix=0;ix<4;ix++){for(let iy=0;iy<4;iy++){if((ix+iy)%2===0){ctx.fillRect(x+ix*st,y+iy*st,st,st);}}}
             break;
        case 'rail': // New Rail Pattern
            const tieWidth = size * 0.8;
            const tieHeight = size * 0.1;
            const railWidth = size * 0.08;
            const railSpacing = size * 0.5; // Spacing between centerlines of rails

            // Ties (horizontal rects)
            ctx.fillStyle = color1; // Use base color (often wood/dirt) for ties
            for (let ty = y + tieHeight; ty < y + size - tieHeight/2; ty += tieHeight * 2.5) {
                 ctx.fillRect(x + (size - tieWidth) / 2, ty, tieWidth, tieHeight);
            }
            // Rails (vertical rects)
            ctx.fillStyle = color2; // Use pattern color (often gray/metal) for rails
            const railOffset = (size - railSpacing) / 2;
            ctx.fillRect(x + railOffset, y, railWidth, size); // Left rail
            ctx.fillRect(x + railOffset + railSpacing - railWidth, y, railWidth, size); // Right rail
            break;
         case 'bricks': // New Brick Pattern
             const brickHeight = size / 4; // 4 rows of bricks
             const brickWidth = size / 2; // 2 bricks wide
             ctx.strokeStyle = color1; // Mortar color (base)
             ctx.fillStyle = color2;   // Brick color (pattern)
             for (let row = 0; row < 4; row++) {
                 const offsetY = (row % 2 === 0) ? 0 : brickWidth / 2; // Offset every other row
                 for (let col = 0; col < 3; col++) { // Draw parts of 3 columns to handle offset
                     const brickX = x + col * brickWidth - offsetY;
                     const brickY = y + row * brickHeight;
                     // Clip brick drawing to the tile bounds
                     ctx.beginPath();
                     ctx.rect(x, y, size, size); // Define clipping region
                     ctx.clip(); // Apply clipping
                     // Draw potentially clipped brick
                     ctx.fillRect(brickX, brickY, brickWidth - lineWidth, brickHeight - lineWidth); // Leave space for mortar
                     ctx.strokeRect(brickX, brickY, brickWidth - lineWidth, brickHeight - lineWidth);
                     // Reset clipping path for next brick (important!) - Although fillRect/strokeRect might work okay without resetting clip per brick, it's safer. We might need save/restore instead.
                     // Let's try without resetting clip, might be faster. If issues, add save/restore around fill/stroke.
                 }
             }
             // Reset clip path after all bricks (need save/restore around the loop really)
             // ctx.restore(); // Would need ctx.save() before the loops
             break;

        default: break;
    }
     // Reset fill/stroke styles? Might not be needed if next draw sets them.
     // ctx.fillStyle = '#000';
     // ctx.strokeStyle = '#000';
}

// Dispatcher function
export function drawGeneratedTile(ctx, x, y, size, tileId) { /* ... Unchanged ... */
    const tileDef = config.GENERATED_TILES[tileId]; if (!tileDef) return;
    // Save context state before drawing complex patterns that might change styles/clip
    ctx.save();
    switch (tileDef.type) {
        case 'color': drawColorTile(ctx, x, y, size, tileDef); break;
        case 'noise': drawNoiseTile(ctx, x, y, size, tileDef); break;
        case 'pattern': drawPatternTile(ctx, x, y, size, tileDef); break;
    }
    ctx.restore(); // Restore context state
}
