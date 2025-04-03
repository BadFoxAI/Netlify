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

// --- UPDATED: Use PRNG for Noise ---
export function drawNoiseTile(ctx, x, y, size, tileDef) {
    const baseColor = tileDef.color1;
    const noiseColor = tileDef.color2;
    const density = tileDef.density || 0.3;
    const numDots = Math.floor(size * size * density);

    // Base color
    ctx.fillStyle = baseColor;
    ctx.fillRect(x, y, size, size);

    // Noise dots using PRNG seeded by coordinates
    // Combine x and y for a simple seed (could use a better hashing function)
    const seed = Math.floor(x * 13 + y * 31); // Simple seeding based on position
    const rng = createPRNG(seed);

    ctx.fillStyle = noiseColor;
    const scaleX = ctx.getTransform().a;
    const scaleY = ctx.getTransform().d;
    const dotSizeX = 1 / scaleX;
    const dotSizeY = 1 / scaleY;

    for (let i = 0; i < numDots; i++) {
        // Use the PRNG instead of Math.random()
        const dotX = x + rng.next() * size;
        const dotY = y + rng.next() * size;
        ctx.fillRect(dotX - dotSizeX / 2, dotY - dotSizeY / 2, dotSizeX, dotSizeY);
    }
}
// --- End Noise Update ---

export function drawPatternTile(ctx, x, y, size, tileDef) {
    const color1 = tileDef.color1; const color2 = tileDef.color2;
    const scale = ctx.getTransform().a; const lineWidth = Math.max(1 / scale, 0.5);
    ctx.fillStyle = color1; ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = color2; ctx.fillStyle = color2; ctx.lineWidth = lineWidth;

    switch (tileDef.pattern) {
        case 'waves':
             const wH = size * 0.15; const wL = size * 0.5; ctx.beginPath();
             for(let wy=y+wH; wy<y+size-wH/2; wy+=wH*2){ ctx.moveTo(x,wy); for(let wx=x; wx<x+size; wx+=wL){ ctx.quadraticCurveTo(wx+wL/4,wy+wH,wx+wL/2,wy); ctx.quadraticCurveTo(wx+(wL*3/4),wy-wH,wx+wL,wy); } } ctx.stroke();
             break;
        case 'lines_h':
             const nLH=5; const sH=size/nLH; ctx.beginPath(); for(let i=1; i<nLH; i++){const ly=y+i*sH; ctx.moveTo(x,ly);ctx.lineTo(x+size,ly);} ctx.stroke();
             break;
        case 'checker':
             const st=size/4; for(let ix=0;ix<4;ix++){for(let iy=0;iy<4;iy++){if((ix+iy)%2===0){ctx.fillRect(x+ix*st,y+iy*st,st,st);}}}
             break;
        case 'rail':
            const tiW = size * 0.8; const tiH = size * 0.1; const rW = size * 0.08; const rS = size * 0.5; const nT = 4; const tS = size / nT;
            ctx.fillStyle = color1; for(let i=0; i<nT; i++){ const tY=y+i*tS+(tS-tiH)/2; ctx.fillRect(x+(size-tiW)/2, tY, tiW, tiH); }
            ctx.fillStyle = color2; const rO = (size - rS) / 2; ctx.fillRect(x + rO, y, rW, size); ctx.fillRect(x + rO + rS - rW, y, rW, size);
            break;
         case 'bricks':
             const nR = 4; const nC = 2; const bH = size / nR; const bW = size / nC;
             ctx.strokeStyle = color1; ctx.fillStyle = color2;
             for(let row=0; row<nR; row++){ const oY=(row%2===0)?0:-bW/2; for(let col=-1; col<=nC; col++){ const bX=x+col*bW+oY; const bY=y+row*bH;
                 ctx.save(); ctx.beginPath(); ctx.rect(x,y,size,size); ctx.clip(); const dW=bW-lineWidth; const dH=bH-lineWidth; ctx.fillRect(bX+lineWidth/2, bY+lineWidth/2, dW, dH); ctx.restore();
             } }
             // Draw mortar lines AFTER fills
             ctx.beginPath();
             // Horizontal lines
             for(let row=1; row<nR; row++){ const lY=y+row*bH; ctx.moveTo(x,lY); ctx.lineTo(x+size,lY); }
             // Vertical lines (staggered)
             for(let row=0; row<nR; row++){ const oY=(row%2===0)?0:-bW/2; for(let col=0; col<=nC; col++){ const lX=x+col*bW+oY; if(lX > x && lX < x+size){ ctx.moveTo(lX, y+row*bH); ctx.lineTo(lX, y+row*bH+bH); } } }
             ctx.stroke();
             break;
        default:
            ctx.fillStyle = color1; ctx.fillRect(x,y,size,size); console.warn(`Unknown pattern type: ${tileDef.pattern}`); break;
    }
}

// Dispatcher function (Unchanged)
export function drawGeneratedTile(ctx, x, y, size, tileId) {
    const tileDef = config.GENERATED_TILES[tileId]; if (!tileDef) { console.error(`Def not found: ${tileId}`); ctx.fillStyle='#FF00FF'; ctx.fillRect(x,y,size,size); ctx.fillStyle='#000'; ctx.font=`${size*0.5}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('?',x+size/2,y+size/2); return; }
    ctx.save(); try { switch(tileDef.type){ case 'color': drawColorTile(ctx,x,y,size,tileDef); break; case 'noise': drawNoiseTile(ctx,x,y,size,tileDef); break; case 'pattern': drawPatternTile(ctx,x,y,size,tileDef); break; default: console.warn(`Unknown type: ${tileDef.type}`); ctx.fillStyle='#FF00FF'; ctx.fillRect(x,y,size,size); break; } } finally { ctx.restore(); }
}
