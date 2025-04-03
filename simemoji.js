import * as config from './config.js';
import * as state from './state.js';
import * as ui from './ui.js';
import { loadGameFromFile, confirmClearSaveData, getEffectiveTileData } from './state.js';

// --- Game State --- (No local copies needed now)
let currentGridSize = config.BASE_GRID_SIZE * state.zoomLevel;

// --- Mouse State --- (Unchanged)
let mouseScreenX = 0, mouseScreenY = 0; let mouseWorldX = 0, mouseWorldY = 0; let mouseGridX = 0, mouseGridY = 0;
let keys = {}; let isPanning = false; let panStartX = 0, panStartY = 0; let panStartCamX = 0, panStartCamY = 0;

// --- Initialization ---
function init() {
    ui.populatePalette(); setupCanvas(); addEventListeners();
    state.loadGameFromLocal(); // Load first
    // Update things AFTER state is loaded/initialized
    updateCurrentGridSize(); clampCamera(); ui.selectTile(state.selectedTile);
    ui.updateSizeUI(); ui.updateLayerUI(); ui.updateToolUI(); ui.updateUndoRedoButtons();
    gameLoop(); console.log("SimEmoji Layers & Slider Initialized.");
}

function setupCanvas() { /* ... Unchanged ... */
    const canvasContainer = document.getElementById('canvasContainer'); const canvas = document.getElementById('gameCanvas');
    canvas.width = canvasContainer.offsetWidth; canvas.height = canvasContainer.offsetHeight;
}

// --- Event Handling Setup ---
function addEventListeners() {
    const canvas = document.getElementById('gameCanvas');
    window.addEventListener('resize', handleResize);
    canvas.addEventListener('mousemove', handleMouseMove); canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp); canvas.addEventListener('mouseout', handleMouseOut);
    canvas.addEventListener('wheel', handleMouseWheel, { passive: false });

    // Tools
    ui.buildToolBtn.addEventListener('click', () => ui.setTool('build'));
    ui.bulldozeToolBtn.addEventListener('click', () => ui.setTool('bulldoze'));
    // Size Slider
    ui.sizeSlider.addEventListener('input', () => ui.selectSize(parseInt(ui.sizeSlider.value, 10))); // Use 'input' for live update
    // Layers
    ui.layerDownBtn.addEventListener('click', () => ui.selectLayer(state.selectedLayer - 1));
    ui.layerUpBtn.addEventListener('click', () => ui.selectLayer(state.selectedLayer + 1));
    // Save/Load/Clear... (Unchanged listeners)
    ui.saveFileBtn.addEventListener('click', state.saveGameToFile);
    ui.loadFileBtn.addEventListener('click', () => ui.fileInput.click());
    ui.fileInput.addEventListener('change', handleFileLoad);
    ui.clearSaveBtn.addEventListener('click', ui.showClearConfirmation);
    ui.clearConfirmYesBtn.addEventListener('click', () => { confirmClearSaveData(); ui.hideClearConfirmation(); });
    ui.clearConfirmNoBtn.addEventListener('click', ui.hideClearConfirmation);
    // Zoom... (Unchanged listeners)
    ui.zoomInBtn.addEventListener('click', () => zoom(1 + config.ZOOM_INCREMENT));
    ui.zoomOutBtn.addEventListener('click', () => zoom(1 / (1 + config.ZOOM_INCREMENT)));
    // Undo/Redo... (Unchanged listeners)
    ui.undoBtn.addEventListener('click', state.undo); ui.redoBtn.addEventListener('click', state.redo);
    // Keyboard... (Unchanged listeners)
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    // State Loaded... (Unchanged listener)
    window.addEventListener('stateLoaded', handleStateLoaded);
}

// --- Event Handlers ---
function handleResize() { setupCanvas(); clampCamera(); }
function handleMouseMove(e) { /* ... Unchanged mouse coord calculation ... */
    const canvas = document.getElementById('gameCanvas'); const rect = canvas.getBoundingClientRect();
    mouseScreenX = e.clientX - rect.left; mouseScreenY = e.clientY - rect.top;
    mouseWorldX = (mouseScreenX / state.zoomLevel) + state.camX; mouseWorldY = (mouseScreenY / state.zoomLevel) + state.camY;
    mouseGridX = Math.floor(mouseWorldX / config.BASE_GRID_SIZE); mouseGridY = Math.floor(mouseWorldY / config.BASE_GRID_SIZE);
    ui.updateCoordsDisplay(mouseGridX, mouseGridY);
    if (isPanning) { /* ... Unchanged panning logic ... */
        const dx = (mouseScreenX - panStartX) / state.zoomLevel; const dy = (mouseScreenY - panStartY) / state.zoomLevel;
        state.setCamPos(panStartCamX - dx, panStartCamY - dy); clampCamera();
    }
}

function handleMouseDown(e) {
    const canvas = document.getElementById('gameCanvas');
    // Panning... (Unchanged)
    if (e.button === 1 || (e.button === 0 && keys['Space'])) {
        isPanning = true; panStartX = mouseScreenX; panStartY = mouseScreenY; panStartCamX = state.camX; panStartCamY = state.camY;
        canvas.style.cursor = 'grabbing'; e.preventDefault(); return;
    }
    // Tool Interaction...
    if (e.button === 0) {
        const size = state.selectedSize; const tool = state.currentTool; const layer = state.selectedLayer; // Get current layer
        const originX = mouseGridX; const originY = mouseGridY;
        if (originX < 0 || originX + size > config.WORLD_WIDTH_CELLS || originY < 0 || originY + size > config.WORLD_HEIGHT_CELLS) return;

        // Bulldoze Logic (Needs to consider layers potentially)
        if (tool === 'bulldoze') {
            // Find the effective object at the click location (could be part of multi-tile)
            const key = `${originX},${originY}`; const targetData = state.gridData.get(key);
            let effectiveOriginX = originX; let effectiveOriginY = originY; let targetSize = 1; let targetLayer = config.DEFAULT_LAYER;
            let mainTargetData = targetData;

            if (typeof targetData === 'object' && targetData !== null && !targetData.isOrigin) {
                effectiveOriginX = targetData.originX; effectiveOriginY = targetData.originY;
                mainTargetData = state.gridData.get(`${effectiveOriginX},${effectiveOriginY}`);
                targetLayer = targetData.layer ?? config.DEFAULT_LAYER; // Use part's layer
            } else if (typeof targetData === 'object' && targetData !== null && targetData.isOrigin) {
                targetLayer = targetData.layer ?? config.DEFAULT_LAYER; // Use origin's layer
            } else if (typeof targetData === 'string') {
                 targetLayer = config.DEFAULT_LAYER; // Simple strings assumed on default layer for now
            }

            if (!mainTargetData) return; // Nothing to bulldoze

            // Get size if it's a multi-tile object origin
            if (typeof mainTargetData === 'object' && mainTargetData !== null && mainTargetData.isOrigin) { targetSize = mainTargetData.size; }

            // Prepare action data
            const cellsToClear = [];
            for (let dx = 0; dx < targetSize; dx++) { for (let dy = 0; dy < targetSize; dy++) {
                    const currentX = effectiveOriginX + dx; const currentY = effectiveOriginY + dy; const currentKey = `${currentX},${currentY}`;
                    const oldData = state.gridData.get(currentKey) || null;
                    if (oldData !== null) { cellsToClear.push({ key: currentKey, oldData: oldData, newData: null }); }
            } }
            if (cellsToClear.length > 0) { state.performAction({ type: 'bulldoze', cells: cellsToClear }); }

        // Build Logic (Needs to consider layers)
        } else if (tool === 'build' && state.selectedTile) {
            let canPlace = true; const cellsToPlace = [];
            for (let dx = 0; dx < size; dx++) { for (let dy = 0; dy < size; dy++) {
                    const currentX = originX + dx; const currentY = originY + dy; const currentKey = `${currentX},${currentY}`;
                    const existingData = state.gridData.get(currentKey);
                    let existingLayer = -1; // Below min layer, means empty or overwritable

                    if (existingData) {
                        if (typeof existingData === 'string') {
                            if (!config.OVERWRITABLE_TILES.has(existingData)) {
                                existingLayer = config.DEFAULT_LAYER; // Assume default layer blocks
                            }
                        } else if (typeof existingData === 'object' && existingData !== null) {
                             // If it's part of an object, check the object's layer at origin
                             if(!existingData.isOrigin) {
                                 const originData = state.gridData.get(`${existingData.originX},${existingData.originY}`);
                                 existingLayer = originData?.layer ?? config.DEFAULT_LAYER;
                             } else {
                                 existingLayer = existingData.layer ?? config.DEFAULT_LAYER;
                             }
                        }
                        // Check if placement is blocked BY LAYER
                        if (existingLayer >= layer) { // Cannot place on same or higher layer
                            canPlace = false; break;
                        }
                    }
                    // Store intended change (including layer)
                    cellsToPlace.push({
                        key: currentKey, oldData: existingData || null,
                        newData: (dx === 0 && dy === 0)
                            ? { tile: state.selectedTile, size: size, layer: layer, isOrigin: true } // Add layer to origin
                            : { originX: originX, originY: originY, layer: layer, isOrigin: false }   // Add layer to part
                    });
            } if (!canPlace) break; }

            if (canPlace) {
                const originKey = `${originX},${originY}`; const originData = state.gridData.get(originKey); let isIdentical = false;
                if (typeof originData === 'object' && originData?.isOrigin && originData.tile === state.selectedTile && originData.size === size && originData.layer === layer) { isIdentical = true; }
                else if (typeof originData === 'string' && originData === state.selectedTile && size === 1 && layer === config.DEFAULT_LAYER) { isIdentical = true; }
                 if (!isIdentical) { state.performAction({ type: 'place', cells: cellsToPlace }); }
            } else { console.log("Placement blocked (layer or existing object)"); }
        }
    }
}
function handleMouseUp(e) { /* ... Unchanged ... */ if (e.button === 1 || (e.button === 0 && isPanning)) { isPanning = false; document.getElementById('gameCanvas').style.cursor = 'crosshair'; } }
function handleMouseOut() { /* ... Unchanged ... */ if (isPanning) { isPanning = false; document.getElementById('gameCanvas').style.cursor = 'crosshair'; } mouseGridX = -1; mouseGridY = -1; ui.updateCoordsDisplay(-1, -1); }
function handleMouseWheel(e) { /* ... Unchanged ... */ e.preventDefault(); const z = e.deltaY < 0 ? (1 + config.ZOOM_INCREMENT) : (1 / (1 + config.ZOOM_INCREMENT)); zoom(z, mouseScreenX, mouseScreenY); }
function handleKeyDown(e) { /* ... Unchanged ... */ keys[e.code] = true; if (e.ctrlKey || e.metaKey) { if (e.code === 'KeyZ') { e.preventDefault(); state.undo(); } else if (e.code === 'KeyY') { e.preventDefault(); state.redo(); } else if (e.code === 'KeyS') { e.preventDefault(); state.saveGameToFile(); } else if (e.code === 'KeyO') { e.preventDefault(); ui.fileInput.click(); } } else { if (e.code === 'KeyB') ui.setTool('build'); if (e.code === 'KeyX') ui.setTool('bulldoze'); if (e.code === 'Equal' || e.code === 'NumpadAdd') zoom(1 + config.ZOOM_INCREMENT); if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoom(1 / (1 + config.ZOOM_INCREMENT)); /* Add layer shortcuts? */ if (e.code === 'Comma') ui.selectLayer(state.selectedLayer - 1); if (e.code === 'Period') ui.selectLayer(state.selectedLayer + 1); } }
function handleFileLoad(event) { /* ... Unchanged ... */ const file = event.target.files[0]; loadGameFromFile(file); event.target.value = null; }
function handleStateLoaded() { /* ... Unchanged ... */ console.log("Reacting to stateLoaded event"); updateCurrentGridSize(); clampCamera(); ui.updateSizeUI(); ui.updateLayerUI();} // Update layer UI too

// --- Core Engine Logic ---
function updateCurrentGridSize() { currentGridSize = config.BASE_GRID_SIZE * state.zoomLevel; }
function clampCamera() { /* ... Unchanged ... */ const c = document.getElementById('gameCanvas'); const wpw=config.WORLD_WIDTH_CELLS*config.BASE_GRID_SIZE; const wph=config.WORLD_HEIGHT_CELLS*config.BASE_GRID_SIZE; const vww=c.width/state.zoomLevel; const vwh=c.height/state.zoomLevel; let nX=state.camX; let nY=state.camY; nX=Math.max(0,Math.min(nX,wpw-vww)); nY=Math.max(0,Math.min(nY,wph-vwh)); if(wpw<vww) nX=(wpw-vww)/2; if(wph<vwh) nY=(wph-vwh)/2; state.setCamPos(nX, nY); }
function zoom(factor, pivotX, pivotY) { /* ... Unchanged ... */ const c=document.getElementById('gameCanvas'); pivotX=pivotX??c.width/2; pivotY=pivotY??c.height/2; const nZ=Math.max(config.MIN_ZOOM,Math.min(config.MAX_ZOOM,state.zoomLevel*factor)); if(nZ===state.zoomLevel)return; const wX=(pivotX/state.zoomLevel)+state.camX; const wY=(pivotY/state.zoomLevel)+state.camY; state.setZoomLevel(nZ); updateCurrentGridSize(); const nCX=wX-(pivotX/nZ); const nCY=wY-(pivotY/nZ); state.setCamPos(nCX, nCY); clampCamera(); }
function updatePanningInput() { /* ... Unchanged ... */ let dx=0; let dy=0; const pA=config.PAN_SPEED_FACTOR*config.BASE_GRID_SIZE; if(keys['ArrowLeft']||keys['KeyA'])dx-=pA; if(keys['ArrowRight']||keys['KeyD'])dx+=pA; if(keys['ArrowUp']||keys['KeyW'])dy-=pA; if(keys['ArrowDown']||keys['KeyS'])dy+=pA; if(dx!==0||dy!==0){state.setCamPos(state.camX+dx,state.camY+dy); clampCamera();} }

// --- Rendering ---
function render() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#5a8b5a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-state.camX * state.zoomLevel, -state.camY * state.zoomLevel);
    ctx.scale(state.zoomLevel, state.zoomLevel);

    // Visible range calculations... (Unchanged)
    const viewLeftWorld = state.camX; const viewTopWorld = state.camY; const viewRightWorld = state.camX + canvas.width / state.zoomLevel;
    const viewBottomWorld = state.camY + canvas.height / state.zoomLevel; const startGridX = Math.floor(viewLeftWorld / config.BASE_GRID_SIZE) - 1;
    const endGridX = Math.ceil(viewRightWorld / config.BASE_GRID_SIZE) + 1; const startGridY = Math.floor(viewTopWorld / config.BASE_GRID_SIZE) - 1;
    const endGridY = Math.ceil(viewBottomWorld / config.BASE_GRID_SIZE) + 1;

    // Draw Grid... (Unchanged)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)'; ctx.lineWidth = 1 / state.zoomLevel;
    for(let x=startGridX; x<=endGridX; x++){const wx=x*config.BASE_GRID_SIZE; ctx.beginPath();ctx.moveTo(wx,startGridY*config.BASE_GRID_SIZE);ctx.lineTo(wx,endGridY*config.BASE_GRID_SIZE);ctx.stroke();}
    for(let y=startGridY; y<=endGridY; y++){const wy=y*config.BASE_GRID_SIZE; ctx.beginPath();ctx.moveTo(startGridX*config.BASE_GRID_SIZE,wy);ctx.lineTo(endGridX*config.BASE_GRID_SIZE,wy);ctx.stroke();}


    // --- Prepare Render List with Layers and Y-Sorting ---
    const renderList = [];
    const baseTileFontSize = config.BASE_GRID_SIZE * 0.8;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; // Set once before loop

    for (let gx = startGridX; gx < endGridX; gx++) {
        for (let gy = startGridY; gy < endGridY; gy++) {
             if (gx < 0 || gx >= config.WORLD_WIDTH_CELLS || gy < 0 || gy >= config.WORLD_HEIGHT_CELLS) continue;
            const gridKey = `${gx},${gy}`;
            const tileData = state.gridData.get(gridKey);

            if (typeof tileData === 'string') {
                // Simple tile string
                 renderList.push({
                    tile: tileData,
                    x: gx * config.BASE_GRID_SIZE + config.BASE_GRID_SIZE / 2, // Center X
                    y: gy * config.BASE_GRID_SIZE + config.BASE_GRID_SIZE / 2, // Center Y
                    size: 1,
                    layer: config.DEFAULT_LAYER, // Assume default layer
                    fontSize: baseTileFontSize,
                    worldYBottom: (gy + 1) * config.BASE_GRID_SIZE // Bottom edge for Y-sort
                });
            } else if (typeof tileData === 'object' && tileData !== null && tileData.isOrigin) {
                // Origin of a multi-tile object
                const objectSize = tileData.size || 1;
                const objectWorldWidth = config.BASE_GRID_SIZE * objectSize;
                const objectWorldHeight = config.BASE_GRID_SIZE * objectSize;
                const centerX = gx * config.BASE_GRID_SIZE + objectWorldWidth / 2;
                const centerY = gy * config.BASE_GRID_SIZE + objectWorldHeight / 2;
                const scaledFontSize = baseTileFontSize * (objectSize * 0.8);

                renderList.push({
                    tile: tileData.tile,
                    x: centerX,
                    y: centerY,
                    size: objectSize,
                    layer: tileData.layer ?? config.DEFAULT_LAYER, // Use object's layer or default
                    fontSize: scaledFontSize,
                    worldYBottom: (gy + objectSize) * config.BASE_GRID_SIZE // Bottom edge for Y-sort
                });
            }
            // Skip non-origin parts
        }
    }

    // --- Sort Render List ---
    renderList.sort((a, b) => {
        // Primary sort: Layer
        if (a.layer !== b.layer) {
            return a.layer - b.layer;
        }
        // Secondary sort: Bottom Y-coordinate (Painter's Algorithm)
        return a.worldYBottom - b.worldYBottom;
    });

    // --- Draw Sorted List ---
    renderList.forEach(item => {
        ctx.font = `${item.fontSize}px sans-serif`;
        ctx.fillText(item.tile, item.x, item.y);
    });

    // Reset font for preview
     ctx.font = `${baseTileFontSize}px sans-serif`;


    // Draw Mouse Hover / Tool Preview (Check placement based on layer)
    if (mouseGridX >= 0 && mouseGridY >= 0 && mouseScreenX >= 0 && mouseScreenY >= 0 && mouseScreenX <= canvas.width && mouseScreenY <= canvas.height)
    {
        const hoverSize = state.currentTool === 'build' ? state.selectedSize : 1;
        const hoverEndX = mouseGridX + hoverSize; const hoverEndY = mouseGridY + hoverSize;
        if (hoverEndX <= config.WORLD_WIDTH_CELLS && hoverEndY <= config.WORLD_HEIGHT_CELLS) {
            const hoverWorldX = mouseGridX * config.BASE_GRID_SIZE; const hoverWorldY = mouseGridY * config.BASE_GRID_SIZE;
            const previewWorldWidth = config.BASE_GRID_SIZE * hoverSize; const previewWorldHeight = config.BASE_GRID_SIZE * hoverSize;
            ctx.lineWidth = 2 / state.zoomLevel;

            if (state.currentTool === 'build' && state.selectedTile) {
                let canPlacePreview = true;
                for (let dx = 0; dx < hoverSize; dx++) { for (let dy = 0; dy < hoverSize; dy++) {
                        const checkX = mouseGridX + dx; const checkY = mouseGridY + dy; const existingData = state.gridData.get(`${checkX},${checkY}`);
                        let existingLayer = -1;
                        if (existingData) {
                            if (typeof existingData === 'string') { if (!config.OVERWRITABLE_TILES.has(existingData)) { existingLayer = config.DEFAULT_LAYER; } }
                            else if (typeof existingData === 'object' && existingData !== null) {
                                if (!existingData.isOrigin) { const originData = state.gridData.get(`${existingData.originX},${existingData.originY}`); existingLayer = originData?.layer ?? config.DEFAULT_LAYER; }
                                else { existingLayer = existingData.layer ?? config.DEFAULT_LAYER; }
                            }
                            if (existingLayer >= state.selectedLayer) { canPlacePreview = false; break; } // Check layer block
                        }
                } if (!canPlacePreview) break; }

                ctx.globalAlpha = 0.5;
                const previewFontSize = baseTileFontSize * (hoverSize * 0.8);
                ctx.font = `${previewFontSize}px sans-serif`;
                ctx.fillText(state.selectedTile, hoverWorldX + previewWorldWidth / 2, hoverWorldY + previewWorldHeight / 2);
                ctx.globalAlpha = 1.0; ctx.font = `${baseTileFontSize}px sans-serif`; // Reset
                ctx.strokeStyle = canPlacePreview ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)'; // Green/Red based on validity
                ctx.strokeRect(hoverWorldX + ctx.lineWidth/2, hoverWorldY + ctx.lineWidth/2, previewWorldWidth - ctx.lineWidth, previewWorldHeight - ctx.lineWidth);

            } else if (state.currentTool === 'bulldoze') { /* ... Bulldoze preview unchanged ... */
                let effectiveOriginX = mouseGridX; let effectiveOriginY = mouseGridY; let targetSize = 1; const targetData = state.gridData.get(`${mouseGridX},${mouseGridY}`);
                 if (typeof targetData === 'object' && targetData !== null && !targetData.isOrigin) { effectiveOriginX = targetData.originX; effectiveOriginY = targetData.originY; const mainTargetData = state.gridData.get(`${effectiveOriginX},${effectiveOriginY}`); if(typeof mainTargetData === 'object' && mainTargetData !== null && mainTargetData.isOrigin) { targetSize = mainTargetData.size; } }
                 else if (typeof targetData === 'object' && targetData !== null && targetData.isOrigin) { targetSize = targetData.size; }
                const effectiveHoverX = effectiveOriginX * config.BASE_GRID_SIZE; const effectiveHoverY = effectiveOriginY * config.BASE_GRID_SIZE; const effectivePreviewSize = config.BASE_GRID_SIZE * targetSize;
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)'; ctx.strokeRect(effectiveHoverX + ctx.lineWidth/2, effectiveHoverY + ctx.lineWidth/2, effectivePreviewSize - ctx.lineWidth, effectivePreviewSize - ctx.lineWidth);
            }
        }
    }


    ctx.restore(); // Restore canvas state
}


// --- Game Loop ---
function gameLoop() { updatePanningInput(); render(); requestAnimationFrame(gameLoop); }

// --- Start ---
init();
