import * as config from './config.js';
import * as state from './state.js';
import * as ui from './ui.js';
import { loadGameFromFile, confirmClearSaveData, getEffectiveTileData } from './state.js';
import { drawGeneratedTile } from './drawingUtils.js'; // Import the drawing dispatcher

// --- Game State ---
let currentGridSize = config.BASE_GRID_SIZE * state.zoomLevel;
// Add state for layer isolation
let isLayerIsolationActive = false;
let isolatedLayer = config.DEFAULT_LAYER;

// --- Mouse State --- (Unchanged)
let mouseScreenX = 0, mouseScreenY = 0; let mouseWorldX = 0, mouseWorldY = 0; let mouseGridX = 0, mouseGridY = 0;
let keys = {}; let isPanning = false; let panStartX = 0, panStartY = 0; let panStartCamX = 0, panStartCamY = 0;

// --- Initialization ---
function init() {
    ui.populatePalette(); setupCanvas(); addEventListeners();
    state.loadGameFromLocal();
    updateCurrentGridSize(); clampCamera(); ui.selectTile(state.selectedTile);
    ui.updateSizeUI(); ui.updateLayerUI(); ui.updateToolUI(); ui.updateUndoRedoButtons();
    // Set initial isolation state based on loaded/default layer
    isolatedLayer = state.selectedLayer;
    updateIsolationButton(); // Update button appearance
    gameLoop(); console.log("SimEmoji Layers & Generated Tiles Initialized.");
}

function setupCanvas() { /* ... Unchanged ... */ }

// --- Event Handling Setup ---
function addEventListeners() {
    // ... (Keep all previous listeners for tools, size, zoom, save/load, etc.) ...
    const canvas = document.getElementById('gameCanvas');
    window.addEventListener('resize', handleResize);
    canvas.addEventListener('mousemove', handleMouseMove); canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp); canvas.addEventListener('mouseout', handleMouseOut);
    canvas.addEventListener('wheel', handleMouseWheel, { passive: false });

    ui.buildToolBtn.addEventListener('click', () => ui.setTool('build')); ui.bulldozeToolBtn.addEventListener('click', () => ui.setTool('bulldoze'));
    ui.sizeSlider.addEventListener('input', () => ui.selectSize(parseInt(ui.sizeSlider.value, 10)));
    ui.layerDownBtn.addEventListener('click', () => changeLayer(-1)); // Use helper
    ui.layerUpBtn.addEventListener('click', () => changeLayer(1)); // Use helper
    ui.saveFileBtn.addEventListener('click', state.saveGameToFile); ui.loadFileBtn.addEventListener('click', () => ui.fileInput.click());
    ui.fileInput.addEventListener('change', handleFileLoad); ui.clearSaveBtn.addEventListener('click', ui.showClearConfirmation);
    ui.clearConfirmYesBtn.addEventListener('click', () => { confirmClearSaveData(); ui.hideClearConfirmation(); });
    ui.clearConfirmNoBtn.addEventListener('click', ui.hideClearConfirmation);
    ui.zoomInBtn.addEventListener('click', () => zoom(1 + config.ZOOM_INCREMENT)); ui.zoomOutBtn.addEventListener('click', () => zoom(1 / (1 + config.ZOOM_INCREMENT)));
    ui.undoBtn.addEventListener('click', state.undo); ui.redoBtn.addEventListener('click', state.redo);

    // Add listener for layer display click to toggle isolation
    ui.layerDisplay.addEventListener('click', toggleLayerIsolation);
    ui.layerDisplay.style.cursor = 'pointer'; // Indicate clickable
    ui.layerDisplay.title = 'Click to toggle layer isolation'; // Add tooltip

    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    window.addEventListener('stateLoaded', handleStateLoaded);
}

// --- Layer Change Helper ---
function changeLayer(delta) {
    const currentLayer = state.selectedLayer;
    let newLayer = currentLayer + delta;
    newLayer = Math.max(config.MIN_LAYER, Math.min(newLayer, config.MAX_LAYER)); // Clamp
    ui.selectLayer(newLayer); // Update state and UI display

    // If isolation is active, also change the isolated layer
    if (isLayerIsolationActive) {
        isolatedLayer = newLayer;
        updateIsolationButton(); // Update visual feedback
    }
}

// --- Layer Isolation ---
function toggleLayerIsolation() {
    isLayerIsolationActive = !isLayerIsolationActive;
    if (isLayerIsolationActive) {
        // When activating, isolate the currently selected layer
        isolatedLayer = state.selectedLayer;
    }
    updateIsolationButton();
    console.log(`Layer Isolation ${isLayerIsolationActive ? 'ON' : 'OFF'} (Layer: ${isolatedLayer})`);
}

function updateIsolationButton() {
    // Add visual feedback to the layer display span
    if (isLayerIsolationActive) {
        ui.layerDisplay.style.border = '1px solid yellow';
        ui.layerDisplay.style.backgroundColor = 'rgba(255, 255, 0, 0.2)';
    } else {
        ui.layerDisplay.style.border = 'none';
        ui.layerDisplay.style.backgroundColor = 'transparent';
    }
    // Update the displayed number (redundant if selectLayer called, but safe)
    ui.layerDisplay.textContent = isLayerIsolationActive ? isolatedLayer : state.selectedLayer;
}


// --- Event Handlers ---
function handleResize() { /* ... Unchanged ... */ }
function handleMouseMove(e) { /* ... Unchanged ... */ }

function handleMouseDown(e) {
    // Panning... (Unchanged)
    if (e.button === 1 || (e.button === 0 && keys['Space'])) { /* ... */ return; }

    // Tool Interaction...
    if (e.button === 0) {
        const size = state.selectedSize; const tool = state.currentTool; const layer = state.selectedLayer;
        const originX = mouseGridX; const originY = mouseGridY;
        if (originX < 0 || originX + size > config.WORLD_WIDTH_CELLS || originY < 0 || originY + size > config.WORLD_HEIGHT_CELLS) return;

        // --- Layer 0 Restriction ---
        const isPlacingGround = config.GENERATED_TILE_IDS.has(state.selectedTile) && config.getDefaultLayerForTile(state.selectedTile) === config.LAYER_GROUND;
        if (tool === 'build') {
            if (layer === config.LAYER_GROUND && !isPlacingGround) {
                ui.showStatusMessage("Only ground tiles on Layer 0!", false); return;
            }
            if (layer > config.LAYER_GROUND && isPlacingGround) {
                ui.showStatusMessage("Ground tiles only on Layer 0!", false); return;
            }
        }
        // --- End Layer 0 Restriction ---


        // Bulldoze Logic (Find object regardless of current layer selection)
        if (tool === 'bulldoze') {
            // Logic to find the topmost object at gx,gy across visible layers might be needed here?
            // For now, it bulldozes whatever is physically at gx,gy in the map data,
            // which might be hidden if isolation is on a different layer.
            // Let's stick to bulldozing what's clicked in the data for simplicity.
            const key = `${originX},${originY}`; const targetData = state.gridData.get(key);
            let effectiveOriginX = originX; let effectiveOriginY = originY; let targetSize = 1;
            let mainTargetData = targetData;
            if (typeof targetData === 'object' && targetData !== null && !targetData.isOrigin) { /* find origin */ effectiveOriginX = targetData.originX; effectiveOriginY = targetData.originY; mainTargetData = state.gridData.get(`${effectiveOriginX},${effectiveOriginY}`); }
            if (!mainTargetData) return;
            if (typeof mainTargetData === 'object' && mainTargetData !== null && mainTargetData.isOrigin) { targetSize = mainTargetData.size; }
            const cellsToClear = [];
            for (let dx = 0; dx < targetSize; dx++) { for (let dy = 0; dy < targetSize; dy++) { /* collect cells */ const cX=effectiveOriginX+dx; const cY=effectiveOriginY+dy; const cK=`${cX},${cY}`; const old=state.gridData.get(cK)||null; if(old!==null) cellsToClear.push({key:cK, oldData:old, newData:null}); } }
            if (cellsToClear.length > 0) { state.performAction({ type: 'bulldoze', cells: cellsToClear }); }

        // Build Logic (Layer checks are crucial)
        } else if (tool === 'build' && state.selectedTile) {
            let canPlace = true; const cellsToPlace = [];
            for (let dx = 0; dx < size; dx++) { for (let dy = 0; dy < size; dy++) {
                    const cX=originX+dx; const cY=originY+dy; const cK=`${cX},${cY}`;
                    const existingData = state.gridData.get(cK);
                    let existingLayer = -Infinity; // Assume nothing is below layer 0

                    if (existingData) {
                        if (typeof existingData === 'string') { existingLayer = config.getDefaultLayerForTile(existingData); } // Simple strings use default
                        else if (typeof existingData === 'object' && existingData !== null) {
                            // Get layer from object itself, or its origin if it's a part
                            if(!existingData.isOrigin) { const oD=state.gridData.get(`${existingData.originX},${existingData.originY}`); existingLayer = oD?.layer ?? config.DEFAULT_LAYER;}
                            else { existingLayer = existingData.layer ?? config.DEFAULT_LAYER; }
                        }
                    }

                    // Cannot place if something exists on the SAME or HIGHER layer,
                    // UNLESS that existing thing is an OVERWRITABLE tile AND we are placing on a STRICTLY HIGHER layer.
                    if (existingData && existingLayer >= layer) {
                         // It's blocked unless the existing is overwritable AND we are placing higher
                         let isOverwritable = false;
                         if(typeof existingData === 'string' && config.OVERWRITABLE_TILES.has(existingData)) {
                             isOverwritable = true;
                         } else if (typeof existingData === 'object' && existingData?.isOrigin && config.OVERWRITABLE_TILES.has(existingData.tile)) {
                             isOverwritable = true;
                         }
                         // If it blocks (same/higher layer) AND (it's not overwritable OR we are placing on the same layer)
                         if (!isOverwritable || layer === existingLayer) {
                            canPlace = false; break;
                         }
                    }

                    // Store intended change
                    cellsToPlace.push({ key: cK, oldData: existingData || null, newData: (dx === 0 && dy === 0) ? { tile: state.selectedTile, size: size, layer: layer, isOrigin: true } : { originX: originX, originY: originY, layer: layer, isOrigin: false } });
            } if (!canPlace) break; }

            if (canPlace) { /* ... check identical placement (unchanged) ... */ const oK=`${originX},${originY}`;const oD=state.gridData.get(oK);let i=false; if(typeof oD==='object'&&oD?.isOrigin&&oD.tile===state.selectedTile&&oD.size===size&&oD.layer===layer){i=true;}else if(typeof oD==='string'&&oD===state.selectedTile&&size===1&&layer===config.getDefaultLayerForTile(oD)){i=true;} if(!i)state.performAction({type:'place',cells:cellsToPlace}); }
            else { console.log("Placement blocked (layer or existing object)"); }
        }
    }
}
function handleMouseUp(e) { /* ... Unchanged ... */ }
function handleMouseOut() { /* ... Unchanged ... */ }
function handleMouseWheel(e) { /* ... Unchanged ... */ }
function handleKeyDown(e) { /* ... Unchanged ... */ keys[e.code]=true;if(e.ctrlKey||e.metaKey){if(e.code==='KeyZ'){e.preventDefault();state.undo();}else if(e.code==='KeyY'){e.preventDefault();state.redo();}else if(e.code==='KeyS'){e.preventDefault();state.saveGameToFile();}else if(e.code==='KeyO'){e.preventDefault();ui.fileInput.click();}}else{if(e.code==='KeyB')ui.setTool('build');if(e.code==='KeyX')ui.setTool('bulldoze');if(e.code==='Equal'||e.code==='NumpadAdd')zoom(1+config.ZOOM_INCREMENT);if(e.code==='Minus'||e.code==='NumpadSubtract')zoom(1/(1+config.ZOOM_INCREMENT));if(e.code==='Comma')changeLayer(-1);if(e.code==='Period')changeLayer(1); /* Layer shortcuts */ if(e.code === 'KeyL') toggleLayerIsolation(); /* Isolation toggle */} }
function handleFileLoad(event) { /* ... Unchanged ... */ }
function handleStateLoaded() { /* ... Unchanged ... */ console.log("Reacting to stateLoaded event"); updateCurrentGridSize(); clampCamera(); ui.updateSizeUI(); ui.updateLayerUI(); updateIsolationButton(); } // Update isolation button too

// --- Core Engine Logic --- (clampCamera, zoom, updatePanningInput, updateCurrentGridSize are unchanged)
function updateCurrentGridSize() { currentGridSize = config.BASE_GRID_SIZE * state.zoomLevel; }
function clampCamera() { const c = document.getElementById('gameCanvas'); const wpw=config.WORLD_WIDTH_CELLS*config.BASE_GRID_SIZE; const wph=config.WORLD_HEIGHT_CELLS*config.BASE_GRID_SIZE; const vww=c.width/state.zoomLevel; const vwh=c.height/state.zoomLevel; let nX=state.camX; let nY=state.camY; nX=Math.max(0,Math.min(nX,wpw-vww)); nY=Math.max(0,Math.min(nY,wph-vwh)); if(wpw<vww) nX=(wpw-vww)/2; if(wph<vwh) nY=(wph-vwh)/2; state.setCamPos(nX, nY); }
function zoom(factor, pivotX, pivotY) { const c=document.getElementById('gameCanvas'); pivotX=pivotX??c.width/2; pivotY=pivotY??c.height/2; const nZ=Math.max(config.MIN_ZOOM,Math.min(config.MAX_ZOOM,state.zoomLevel*factor)); if(nZ===state.zoomLevel)return; const wX=(pivotX/state.zoomLevel)+state.camX; const wY=(pivotY/state.zoomLevel)+state.camY; state.setZoomLevel(nZ); updateCurrentGridSize(); const nCX=wX-(pivotX/nZ); const nCY=wY-(pivotY/nZ); state.setCamPos(nCX, nCY); clampCamera(); }
function updatePanningInput() { let dx=0; let dy=0; const pA=config.PAN_SPEED_FACTOR*config.BASE_GRID_SIZE; if(keys['ArrowLeft']||keys['KeyA'])dx-=pA; if(keys['ArrowRight']||keys['KeyD'])dx+=pA; if(keys['ArrowUp']||keys['KeyW'])dy-=pA; if(keys['ArrowDown']||keys['KeyS'])dy+=pA; if(dx!==0||dy!==0){state.setCamPos(state.camX+dx,state.camY+dy); clampCamera();} }


// --- Rendering ---
function render() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#5a8b5a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-state.camX * state.zoomLevel, -state.camY * state.zoomLevel);
    ctx.scale(state.zoomLevel, state.zoomLevel);

    // Visible range... (Unchanged)
    const viewLeftWorld=state.camX; const viewTopWorld=state.camY; const viewRightWorld=state.camX+canvas.width/state.zoomLevel; const viewBottomWorld=state.camY+canvas.height/state.zoomLevel;
    const startGridX=Math.floor(viewLeftWorld/config.BASE_GRID_SIZE)-1; const endGridX=Math.ceil(viewRightWorld/config.BASE_GRID_SIZE)+1;
    const startGridY=Math.floor(viewTopWorld/config.BASE_GRID_SIZE)-1; const endGridY=Math.ceil(viewBottomWorld/config.BASE_GRID_SIZE)+1;

    // Draw Grid... (Unchanged)
    ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=1/state.zoomLevel;
    for(let x=startGridX;x<=endGridX;x++){const wx=x*config.BASE_GRID_SIZE; ctx.beginPath();ctx.moveTo(wx,startGridY*config.BASE_GRID_SIZE);ctx.lineTo(wx,endGridY*config.BASE_GRID_SIZE);ctx.stroke();}
    for(let y=startGridY;y<=endGridY;y++){const wy=y*config.BASE_GRID_SIZE; ctx.beginPath();ctx.moveTo(startGridX*config.BASE_GRID_SIZE,wy);ctx.lineTo(endGridX*config.BASE_GRID_SIZE,wy);ctx.stroke();}

    // --- Prepare Render List (Handles Layers & Isolation) ---
    const renderList = [];
    const baseTileFontSize = config.BASE_GRID_SIZE * 0.8;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    for (let gx = startGridX; gx < endGridX; gx++) {
        for (let gy = startGridY; gy < endGridY; gy++) {
            if (gx < 0 || gx >= config.WORLD_WIDTH_CELLS || gy < 0 || gy >= config.WORLD_HEIGHT_CELLS) continue;
            const gridKey = `${gx},${gy}`;
            const tileData = state.gridData.get(gridKey);
            let itemLayer = -1; // Layer for sorting

            // --- Filtering for Layer Isolation ---
            let skipBecauseIsolated = false;
            if (isLayerIsolationActive) {
                if (!tileData) { // Skip empty cells in isolation mode
                     skipBecauseIsolated = true;
                } else if (typeof tileData === 'string') {
                     itemLayer = config.getDefaultLayerForTile(tileData);
                     if (itemLayer !== isolatedLayer) skipBecauseIsolated = true;
                } else if (typeof tileData === 'object' && tileData !== null) {
                    // Need layer from origin if it's a part
                    if (!tileData.isOrigin) {
                        const originData = state.gridData.get(`${tileData.originX},${tileData.originY}`);
                        itemLayer = originData?.layer ?? config.DEFAULT_LAYER;
                    } else {
                        itemLayer = tileData.layer ?? config.DEFAULT_LAYER;
                    }
                    if (itemLayer !== isolatedLayer) skipBecauseIsolated = true;
                }
            }
            if (skipBecauseIsolated) continue; // --- End Isolation Filter ---


            // --- Add items to render list if not filtered out ---
            if (typeof tileData === 'string') {
                itemLayer = config.getDefaultLayerForTile(tileData); // Get layer for sorting if not isolating
                renderList.push({ tile: tileData, x: gx*config.BASE_GRID_SIZE+config.BASE_GRID_SIZE/2, y: gy*config.BASE_GRID_SIZE+config.BASE_GRID_SIZE/2, size: 1, layer: itemLayer, fontSize: baseTileFontSize, worldYBottom: (gy+1)*config.BASE_GRID_SIZE, isGenerated: config.GENERATED_TILE_IDS.has(tileData) });
            } else if (typeof tileData === 'object' && tileData !== null && tileData.isOrigin) {
                const objectSize = tileData.size || 1;
                const objectWorldWidth = config.BASE_GRID_SIZE * objectSize;
                const objectWorldHeight = config.BASE_GRID_SIZE * objectSize;
                const centerX = gx*config.BASE_GRID_SIZE + objectWorldWidth/2;
                const centerY = gy*config.BASE_GRID_SIZE + objectWorldHeight/2;
                const scaledFontSize = baseTileFontSize * (objectSize * 0.8);
                itemLayer = tileData.layer ?? config.DEFAULT_LAYER; // Get layer for sorting if not isolating

                renderList.push({ tile: tileData.tile, x: centerX, y: centerY, size: objectSize, layer: itemLayer, fontSize: scaledFontSize, worldYBottom: (gy+objectSize)*config.BASE_GRID_SIZE, isGenerated: config.GENERATED_TILE_IDS.has(tileData.tile) });
            }
        }
    }

    // Sort Render List (Unchanged - sorts by layer then Y)
    renderList.sort((a, b) => { if (a.layer !== b.layer) return a.layer - b.layer; return a.worldYBottom - b.worldYBottom; });

    // Draw Sorted List (Uses drawingUtils for generated tiles)
    renderList.forEach(item => {
        if (item.isGenerated) {
            // Draw generated tile using utility function
            // Calculate top-left corner for drawing function
            const drawX = item.x - (config.BASE_GRID_SIZE * item.size) / 2;
            const drawY = item.y - (config.BASE_GRID_SIZE * item.size) / 2;
            drawGeneratedTile(ctx, drawX, drawY, config.BASE_GRID_SIZE * item.size, item.tile);
        } else {
            // Draw emoji
            ctx.font = `${item.fontSize}px sans-serif`;
            ctx.fillText(item.tile, item.x, item.y);
        }
    });

    // Reset font after drawing list
    ctx.font = `${baseTileFontSize}px sans-serif`;


    // Draw Mouse Hover / Tool Preview (Layer check updated)
    if (mouseGridX >= 0 && mouseGridY >= 0 && mouseScreenX >= 0 && mouseScreenY >= 0 && mouseScreenX <= canvas.width && mouseScreenY <= canvas.height) {
        const hoverSize = state.currentTool === 'build' ? state.selectedSize : 1;
        const hoverEndX = mouseGridX + hoverSize; const hoverEndY = mouseGridY + hoverSize;
        if (hoverEndX <= config.WORLD_WIDTH_CELLS && hoverEndY <= config.WORLD_HEIGHT_CELLS) {
            const hoverWorldX = mouseGridX * config.BASE_GRID_SIZE; const hoverWorldY = mouseGridY * config.BASE_GRID_SIZE;
            const previewWorldWidth = config.BASE_GRID_SIZE * hoverSize; const previewWorldHeight = config.BASE_GRID_SIZE * hoverSize;
            ctx.lineWidth = 2 / state.zoomLevel;

            if (state.currentTool === 'build' && state.selectedTile) {
                // --- Preview Validity Check (including Layer 0 rule) ---
                let canPlacePreview = true;
                const placingLayer = state.selectedLayer;
                const isPlacingGroundTile = config.GENERATED_TILE_IDS.has(state.selectedTile) && config.getDefaultLayerForTile(state.selectedTile) === config.LAYER_GROUND;

                if (placingLayer === config.LAYER_GROUND && !isPlacingGroundTile) canPlacePreview = false;
                if (placingLayer > config.LAYER_GROUND && isPlacingGroundTile) canPlacePreview = false;

                if (canPlacePreview) { // Only check grid if layer rule passes
                    for (let dx = 0; dx < hoverSize; dx++) { for (let dy = 0; dy < hoverSize; dy++) {
                            const cX=mouseGridX+dx; const cY=mouseGridY+dy; const eD=state.gridData.get(`${cX},${cY}`); let eL = -Infinity;
                            if(eD){ if(typeof eD==='string'){eL=config.getDefaultLayerForTile(eD);}else if(typeof eD==='object'&&eD!==null){if(!eD.isOrigin){const oD=state.gridData.get(`${eD.originX},${eD.originY}`);eL=oD?.layer??config.DEFAULT_LAYER;}else{eL=eD.layer??config.DEFAULT_LAYER;}}}
                            if (eD && eL >= placingLayer) {
                                let isOverwritable = false; if(typeof eD === 'string' && config.OVERWRITABLE_TILES.has(eD)) {isOverwritable = true;} else if (typeof eD === 'object' && eD?.isOrigin && config.OVERWRITABLE_TILES.has(eD.tile)) {isOverwritable = true;}
                                if (!isOverwritable || placingLayer === eL) { canPlacePreview = false; break; }
                            }
                    } if (!canPlacePreview) break; }
                }
                // --- End Preview Validity Check ---


                ctx.globalAlpha = 0.5;
                const previewFontSize = baseTileFontSize * (hoverSize * 0.8); // Scale preview size
                ctx.font = `${previewFontSize}px sans-serif`;

                if (config.GENERATED_TILE_IDS.has(state.selectedTile)) {
                     // Draw generated tile preview centered
                     const previewDrawX = hoverWorldX + (previewWorldWidth - config.BASE_GRID_SIZE * hoverSize) / 2; // Should be 0 offset if size matches
                     const previewDrawY = hoverWorldY + (previewWorldHeight - config.BASE_GRID_SIZE * hoverSize) / 2;
                     drawGeneratedTile(ctx, previewDrawX, previewDrawY, config.BASE_GRID_SIZE * hoverSize, state.selectedTile);
                } else {
                    // Draw emoji preview centered
                    ctx.fillText(state.selectedTile, hoverWorldX + previewWorldWidth / 2, hoverWorldY + previewWorldHeight / 2);
                }

                ctx.globalAlpha = 1.0; ctx.font = `${baseTileFontSize}px sans-serif`; // Reset font
                ctx.strokeStyle = canPlacePreview ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)';
                ctx.strokeRect(hoverWorldX + ctx.lineWidth/2, hoverWorldY + ctx.lineWidth/2, previewWorldWidth - ctx.lineWidth, previewWorldHeight - ctx.lineWidth);

            } else if (state.currentTool === 'bulldoze') { /* ... Bulldoze preview unchanged ... */ }
        }
    }

    ctx.restore();
}


// --- Game Loop --- (Unchanged)
function gameLoop(){updatePanningInput();render();requestAnimationFrame(gameLoop);}
// --- Start --- (Unchanged)
init();
