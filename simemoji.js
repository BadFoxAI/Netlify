import * as config from './config.js';
import * as state from './state.js';
import * as ui from './ui.js';
import { loadGameFromFile, confirmClearSaveData, getEffectiveTileData } from './state.js';
import { drawGeneratedTile } from './drawingUtils.js';

// --- Game State ---
let currentGridSize = config.BASE_GRID_SIZE * state.zoomLevel;
let isLayerIsolationActive = false;
let isolatedLayer = config.DEFAULT_LAYER; // Store the isolated layer #

// --- Mouse State --- (Unchanged)
let mouseScreenX = 0, mouseScreenY = 0; let mouseWorldX = 0, mouseWorldY = 0; let mouseGridX = 0, mouseGridY = 0;
let keys = {}; let isPanning = false; let panStartX = 0, panStartY = 0; let panStartCamX = 0, panStartCamY = 0;

// --- Initialization ---
function init() {
    ui.populatePalette(); setupCanvas(); addEventListeners();
    state.loadGameFromLocal();
    updateCurrentGridSize(); clampCamera(); ui.selectTile(state.selectedTile);
    ui.updateSizeUI(); ui.updateLayerUI(); ui.updateToolUI(); ui.updateUndoRedoButtons();
    // Initialize isolation state based on loaded/default layer
    isolatedLayer = state.selectedLayer; // Start isolating the current layer if toggled
    updateIsolationDisplay(); // Update button appearance
    gameLoop(); console.log("SimEmoji v7 Initialized.");
}

function setupCanvas() { /* ... Unchanged ... */ }

// --- Event Handling Setup ---
function addEventListeners() {
    // ... (Keep listeners for tools, size, zoom, save/load, file input, clear confirm, keyboard, stateLoaded) ...
     const canvas = document.getElementById('gameCanvas');
    window.addEventListener('resize', handleResize); canvas.addEventListener('mousemove', handleMouseMove); canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp); canvas.addEventListener('mouseout', handleMouseOut); canvas.addEventListener('wheel', handleMouseWheel, { passive: false });
    ui.buildToolBtn.addEventListener('click', () => ui.setTool('build')); ui.bulldozeToolBtn.addEventListener('click', () => ui.setTool('bulldoze'));
    ui.sizeSlider.addEventListener('input', () => ui.selectSize(parseInt(ui.sizeSlider.value, 10)));
    ui.layerDownBtn.addEventListener('click', () => changeLayer(-1)); ui.layerUpBtn.addEventListener('click', () => changeLayer(1));
    ui.saveFileBtn.addEventListener('click', state.saveGameToFile); ui.loadFileBtn.addEventListener('click', () => ui.fileInput.click());
    ui.fileInput.addEventListener('change', handleFileLoad); ui.clearSaveBtn.addEventListener('click', ui.showClearConfirmation);
    ui.clearConfirmYesBtn.addEventListener('click', () => { confirmClearSaveData(); ui.hideClearConfirmation(); }); // confirmClearSaveData now resets state
    ui.clearConfirmNoBtn.addEventListener('click', ui.hideClearConfirmation);
    ui.zoomInBtn.addEventListener('click', () => zoom(1 + config.ZOOM_INCREMENT)); ui.zoomOutBtn.addEventListener('click', () => zoom(1 / (1 + config.ZOOM_INCREMENT)));
    ui.undoBtn.addEventListener('click', state.undo); ui.redoBtn.addEventListener('click', state.redo);
    ui.layerDisplay.addEventListener('click', toggleLayerIsolation); ui.layerDisplay.style.cursor = 'pointer'; ui.layerDisplay.title = 'Click to toggle layer isolation';
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    window.addEventListener('stateLoaded', handleStateLoaded);
}

// --- Layer Change Helper --- (Update isolation if active)
function changeLayer(delta) {
    const currentLayer = state.selectedLayer; let newLayer = currentLayer + delta;
    newLayer = Math.max(config.MIN_LAYER, Math.min(newLayer, config.MAX_LAYER));
    ui.selectLayer(newLayer);
    if (isLayerIsolationActive) { isolatedLayer = newLayer; updateIsolationDisplay(); }
}

// --- Layer Isolation --- (Toggle logic remains same)
function toggleLayerIsolation() {
    isLayerIsolationActive = !isLayerIsolationActive;
    if (isLayerIsolationActive) { isolatedLayer = state.selectedLayer; } // Isolate current on activation
    updateIsolationDisplay();
    console.log(`Layer Isolation ${isLayerIsolationActive ? 'ON' : 'OFF'} (Layer: ${isolatedLayer})`);
}
function updateIsolationDisplay() { // Update appearance of layer number
    const displayElement = ui.layerDisplay; // Assuming ui.js exports layerDisplay
    displayElement.textContent = state.selectedLayer; // Always show selected layer
    if (isLayerIsolationActive) {
        displayElement.style.border = '1px solid yellow';
        displayElement.style.backgroundColor = 'rgba(255, 255, 0, 0.2)';
        displayElement.title = `Isolating Layer ${isolatedLayer} (Click to toggle OFF)`;
    } else {
        displayElement.style.border = 'none';
        displayElement.style.backgroundColor = 'transparent';
        displayElement.title = 'Click to toggle layer isolation';
    }
}


// --- Event Handlers ---
function handleResize() { /* ... Unchanged ... */ }
function handleMouseMove(e) { /* ... Unchanged ... */ }

function handleMouseDown(e) {
    // Panning... (Unchanged)
    if (e.button === 1 || (e.button === 0 && keys['Space'])) { /*...*/ return; }

    // Tool Interaction...
    if (e.button === 0) {
        const size = state.selectedSize; const tool = state.currentTool; const layerToPlaceOn = state.selectedLayer;
        const originX = mouseGridX; const originY = mouseGridY;
        if (originX < 0 || originX + size > config.WORLD_WIDTH_CELLS || originY < 0 || originY + size > config.WORLD_HEIGHT_CELLS) return;

        const tileToPlace = state.selectedTile;
        const requiredLayer = config.getDefaultLayerForTile(tileToPlace);
        const isGroundTile = config.GROUND_TILES.has(tileToPlace);
        const isPathTile = config.PATH_TILES.has(tileToPlace);

        // --- Layer Placement Rule Check ---
        if (tool === 'build') {
            if (layerToPlaceOn === config.LAYER_GROUND && !isGroundTile) { ui.showStatusMessage("Only Ground tiles on Layer 0!", false); return; }
            if (layerToPlaceOn > config.LAYER_GROUND && isGroundTile) { ui.showStatusMessage("Ground tiles only on Layer 0!", false); return; }
            if (layerToPlaceOn === config.LAYER_PATHS && !isPathTile && !isGroundTile) { /* Allow features/buildings etc on paths */ }
            // Could add more rules: e.g., Buildings only on Ground/Paths?
        }
        // --- End Layer Placement Rule Check ---


        // Bulldoze Logic (Remains largely unchanged - targets data regardless of isolation)
        if (tool === 'bulldoze') {
            const key = `${originX},${originY}`; const targetData = state.gridData.get(key);
            let effX = originX; let effY = originY; let tSize = 1; let mainTargetData = targetData;
            if(typeof targetData === 'object' && targetData !== null && !targetData.isOrigin){ effX=targetData.originX; effY=targetData.originY; mainTargetData = state.gridData.get(`${effX},${effY}`);}
            if (!mainTargetData) return; if (typeof mainTargetData === 'object' && mainTargetData !== null && mainTargetData.isOrigin) { tSize = mainTargetData.size; }
            const cellsToClear = [];
            for(let dx=0;dx<tSize;dx++){for(let dy=0;dy<tSize;dy++){const cX=effX+dx; const cY=effY+dy; const cK=`${cX},${cY}`; const old=state.gridData.get(cK)||null; if(old!==null) cellsToClear.push({key:cK, oldData:old, newData:null});}}
            if (cellsToClear.length > 0) { state.performAction({ type: 'bulldoze', cells: cellsToClear }); }

        // Build Logic (Revised layer checking)
        } else if (tool === 'build' && tileToPlace) {
            let canPlace = true;
            const cellsToModify = [];

            for (let dx = 0; dx < size; dx++) { for (let dy = 0; dy < size; dy++) {
                const cX = originX + dx; const cY = originY + dy; const cK = `${cX},${cY}`;
                const existingData = state.gridData.get(cK);
                let highestExistingLayer = -Infinity; // Track highest layer in this specific cell

                if (existingData) {
                     let effData = existingData; let eLayer = config.DEFAULT_LAYER;
                     if(typeof eD==='object'&&eD!==null){if(!eD.isOrigin){const oD=state.gridData.get(`${eD.originX},${eD.originY}`);effData=oD;eL=oD?.layer??config.DEFAULT_LAYER;}else{eL=eD.layer??config.DEFAULT_LAYER;}}
                     else if(typeof eD==='string'){eL=config.getDefaultLayerForTile(eD);}
                     highestExistingLayer = Math.max(highestExistingLayer, eLayer);
                }

                // --- BLOCK PLACEMENT IF placing on a layer <= highest existing layer in cell ---
                // Exception: Allow replacing ground/paths on their respective layers? - This is complex.
                // Simplified rule: Block if target layer is <= highest existing layer.
                 if (highestExistingLayer >= layerToPlaceOn) {
                     // Allow placing paths ON layer 1 even if ground (layer 0) exists
                     if (!(layerToPlaceOn === config.LAYER_PATHS && highestExistingLayer === config.LAYER_GROUND)) {
                        // Allow placing features ON layer 2 even if ground/path (0/1) exists
                         if (!(layerToPlaceOn === config.LAYER_FEATURES && highestExistingLayer <= config.LAYER_PATHS)) {
                            // Allow placing buildings ON layer 3 even if ground/path/feature (0/1/2) exists
                             if (!(layerToPlaceOn === config.LAYER_BUILDINGS && highestExistingLayer <= config.LAYER_FEATURES)) {
                                // Allow placing air ON layer 4 even if anything below exists
                                 if (!(layerToPlaceOn === config.LAYER_AIR && highestExistingLayer <= config.LAYER_BUILDINGS)) {
                                     canPlace = false; // Blocked!
                                     break;
                                 }
                             }
                         }
                     }
                 }


                // Store potential change (will only be applied if canPlace is true)
                cellsToModify.push({ key: cK, oldData: existingData || null, newData: (dx === 0 && dy === 0) ? { tile: tileToPlace, size: size, layer: layerToPlaceOn, isOrigin: true } : { originX: originX, originY: originY, layer: layerToPlaceOn, isOrigin: false } });
            } if (!canPlace) break; } // Break outer loop if blocked

            if (canPlace) {
                 // Check identical placement...
                 const oK=`${originX},${originY}`;const oD=state.gridData.get(oK);let i=false;
                 if(typeof oD==='object'&&oD?.isOrigin&&oD.tile===tileToPlace&&oD.size===size&&oD.layer===layerToPlaceOn){i=true;}
                 else if(typeof oD==='string'&&oD===tileToPlace&&size===1&&layerToPlaceOn===config.getDefaultLayerForTile(oD)){i=true;}
                 if(!i)state.performAction({type:'place',cells:cellsToModify});
            } else { console.log("Placement blocked (layer rules)"); ui.showStatusMessage("Blocked by object/layer", false); }
        }
    }
}
function handleMouseUp(e) { /* ... Unchanged ... */ }
function handleMouseOut() { /* ... Unchanged ... */ }
function handleMouseWheel(e) { /* ... Unchanged ... */ }
function handleKeyDown(e) { /* ... (Mostly Unchanged - added L for isolation) ... */ keys[e.code]=true;if(e.ctrlKey||e.metaKey){if(e.code==='KeyZ'){e.preventDefault();state.undo();}else if(e.code==='KeyY'){e.preventDefault();state.redo();}else if(e.code==='KeyS'){e.preventDefault();state.saveGameToFile();}else if(e.code==='KeyO'){e.preventDefault();ui.fileInput.click();}}else{if(e.code==='KeyB')ui.setTool('build');if(e.code==='KeyX')ui.setTool('bulldoze');if(e.code==='Equal'||e.code==='NumpadAdd')zoom(1+config.ZOOM_INCREMENT);if(e.code==='Minus'||e.code==='NumpadSubtract')zoom(1/(1+config.ZOOM_INCREMENT));if(e.code==='Comma')changeLayer(-1);if(e.code==='Period')changeLayer(1); if(e.code === 'KeyL') toggleLayerIsolation();} }
function handleFileLoad(event) { /* ... Unchanged ... */ }
function handleStateLoaded() { /* ... Unchanged ... */ console.log("Reacting to stateLoaded event"); updateCurrentGridSize(); clampCamera(); ui.updateSizeUI(); ui.updateLayerUI(); updateIsolationDisplay(); } // Update isolation display too

// --- Core Engine Logic --- (clampCamera, zoom, updatePanningInput, updateCurrentGridSize are unchanged)
function updateCurrentGridSize() { currentGridSize = config.BASE_GRID_SIZE * state.zoomLevel; }
function clampCamera() { /* ... */ }
function zoom(factor, pivotX, pivotY) { /* ... */ }
function updatePanningInput() { /* ... */ }


// --- Rendering --- (Incorporates Layer Isolation Filter)
function render() {
    const canvas = document.getElementById('gameCanvas'); const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#5a8b5a'; ctx.fillRect(0, 0, canvas.width, canvas.height); // Background
    ctx.save();
    ctx.translate(-state.camX * state.zoomLevel, -state.camY * state.zoomLevel); ctx.scale(state.zoomLevel, state.zoomLevel);

    // Visible range... (Unchanged)
    const viewLeftWorld=state.camX; const viewTopWorld=state.camY; const viewRightWorld=state.camX+canvas.width/state.zoomLevel; const viewBottomWorld=state.camY+canvas.height/state.zoomLevel; const startGridX=Math.floor(viewLeftWorld/config.BASE_GRID_SIZE)-1; const endGridX=Math.ceil(viewRightWorld/config.BASE_GRID_SIZE)+1; const startGridY=Math.floor(viewTopWorld/config.BASE_GRID_SIZE)-1; const endGridY=Math.ceil(viewBottomWorld/config.BASE_GRID_SIZE)+1;

    // Draw Grid... (Unchanged)
    ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=1/state.zoomLevel; for(let x=startGridX;x<=endGridX;x++){const wx=x*config.BASE_GRID_SIZE; ctx.beginPath();ctx.moveTo(wx,startGridY*config.BASE_GRID_SIZE);ctx.lineTo(wx,endGridY*config.BASE_GRID_SIZE);ctx.stroke();} for(let y=startGridY;y<=endGridY;y++){const wy=y*config.BASE_GRID_SIZE; ctx.beginPath();ctx.moveTo(startGridX*config.BASE_GRID_SIZE,wy);ctx.lineTo(endGridX*config.BASE_GRID_SIZE,wy);ctx.stroke();}

    // Prepare Render List (Handles Layers & Isolation)
    const renderList = []; const baseTileFontSize = config.BASE_GRID_SIZE*0.8;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    for (let gx = startGridX; gx < endGridX; gx++) { for (let gy = startGridY; gy < endGridY; gy++) {
        if(gx<0||gx>=config.WORLD_WIDTH_CELLS||gy<0||gy>=config.WORLD_HEIGHT_CELLS) continue;
        const gridKey = `${gx},${gy}`; const tileData = state.gridData.get(gridKey);
        let itemLayer = config.DEFAULT_LAYER; // Default assume
        let tileIdToRender = null; let itemSize = 1; let itemFontSize = baseTileFontSize; let isGenerated = false;
        let worldX = 0, worldY = 0, worldYBottom = 0;

        if (typeof tileData === 'string') {
            itemLayer = config.getDefaultLayerForTile(tileData);
            tileIdToRender = tileData; itemSize = 1; worldX = gx*config.BASE_GRID_SIZE+config.BASE_GRID_SIZE/2; worldY = gy*config.BASE_GRID_SIZE+config.BASE_GRID_SIZE/2; worldYBottom = (gy+1)*config.BASE_GRID_SIZE; isGenerated = config.GENERATED_TILE_IDS.has(tileData); itemFontSize = baseTileFontSize;
        } else if (typeof tileData === 'object' && tileData !== null && tileData.isOrigin) {
            itemLayer = tileData.layer ?? config.DEFAULT_LAYER;
            tileIdToRender = tileData.tile; itemSize = tileData.size || 1; const oWW = config.BASE_GRID_SIZE*itemSize; const oWH = config.BASE_GRID_SIZE*itemSize; worldX = gx*config.BASE_GRID_SIZE + oWW/2; worldY = gy*config.BASE_GRID_SIZE + oWH/2; worldYBottom = (gy+itemSize)*config.BASE_GRID_SIZE; isGenerated = config.GENERATED_TILE_IDS.has(tileData.tile); itemFontSize = baseTileFontSize*(itemSize*0.8);
        }

        // --- Filtering for Layer Isolation ---
        if (isLayerIsolationActive && itemLayer !== isolatedLayer) {
            continue; // Skip if isolation is ON and layer doesn't match
        }
        // --- End Isolation Filter ---

        if (tileIdToRender !== null) { // Add valid items to list
            renderList.push({ tile: tileIdToRender, x: worldX, y: worldY, size: itemSize, layer: itemLayer, fontSize: itemFontSize, worldYBottom: worldYBottom, isGenerated: isGenerated });
        }
    }} // End grid loops

    // Sort Render List (Unchanged)
    renderList.sort((a,b)=>{if(a.layer!==b.layer)return a.layer-b.layer; return a.worldYBottom-b.worldYBottom;});

    // Draw Sorted List (Unchanged)
    renderList.forEach(item=>{if(item.isGenerated){const dX=item.x-(config.BASE_GRID_SIZE*item.size)/2; const dY=item.y-(config.BASE_GRID_SIZE*item.size)/2; drawGeneratedTile(ctx,dX,dY,config.BASE_GRID_SIZE*item.size,item.tile);}else{ctx.font=`${item.fontSize}px sans-serif`; ctx.fillText(item.tile,item.x,item.y);}});
    ctx.font = `${baseTileFontSize}px sans-serif`;// Reset font

    // Draw Preview... (Needs validity check update for layers)
    if (mouseGridX >= 0 && mouseGridY >= 0 && mouseScreenX >= 0 && mouseScreenY >= 0 && mouseScreenX <= canvas.width && mouseScreenY <= canvas.height){
        const hoverSize=state.currentTool==='build'?state.selectedSize:1; const hEndX=mouseGridX+hoverSize; const hEndY=mouseGridY+hoverSize;
        if(hEndX<=config.WORLD_WIDTH_CELLS&&hEndY<=config.WORLD_HEIGHT_CELLS){
            const hWX=mouseGridX*config.BASE_GRID_SIZE; const hWY=mouseGridY*config.BASE_GRID_SIZE; const pWW=config.BASE_GRID_SIZE*hoverSize; const pWH=config.BASE_GRID_SIZE*hoverSize; ctx.lineWidth=2/state.zoomLevel;
            if(state.currentTool==='build'&&state.selectedTile){
                let canPlacePreview=true; const pLayer=state.selectedLayer; const isPGround=config.GROUND_TILES.has(state.selectedTile);
                if(pLayer===config.LAYER_GROUND&&!isPGround)canPlacePreview=false; if(pLayer>config.LAYER_GROUND&&isPGround)canPlacePreview=false;
                if(canPlacePreview){for(let dx=0;dx<hoverSize;dx++){for(let dy=0;dy<hoverSize;dy++){ const cX=mouseGridX+dx;const cY=mouseGridY+dy;const eD=state.gridData.get(`${cX},${cY}`);let eL=-Infinity;
                    if(eD){if(typeof eD==='string'){eL=config.getDefaultLayerForTile(eD);}else if(typeof eD==='object'&&eD!==null){if(!eD.isOrigin){const oD=state.gridData.get(`${eD.originX},${eD.originY}`);eL=oD?.layer??config.DEFAULT_LAYER;}else{eL=eD.layer??config.DEFAULT_LAYER;}}}
                    if(eD&&eL>=pLayer){let iO=false;if(typeof eD==='string'&&config.OVERWRITABLE_TILES.has(eD)){iO=true;}else if(typeof eD==='object'&&eD?.isOrigin&&config.OVERWRITABLE_TILES.has(eD.tile)){iO=true;}if(!iO||pLayer===eL){canPlacePreview=false;break;}}
                }if(!canPlacePreview)break;}} // End validity check

                ctx.globalAlpha=0.5; const pFS=baseTileFontSize*(hoverSize*0.8); ctx.font=`${pFS}px sans-serif`;
                if(config.GENERATED_TILE_IDS.has(state.selectedTile)){const pDX=hWX+(pWW-config.BASE_GRID_SIZE*hoverSize)/2;const pDY=hWY+(pWH-config.BASE_GRID_SIZE*hoverSize)/2;drawGeneratedTile(ctx,pDX,pDY,config.BASE_GRID_SIZE*hoverSize,state.selectedTile);}else{ctx.fillText(state.selectedTile,hWX+pWW/2,hWY+pWH/2);}
                ctx.globalAlpha=1.0; ctx.font=`${baseTileFontSize}px sans-serif`; ctx.strokeStyle=canPlacePreview?'rgba(0,255,0,0.8)':'rgba(255,0,0,0.8)'; ctx.strokeRect(hWX+ctx.lineWidth/2,hWY+ctx.lineWidth/2,pWW-ctx.lineWidth,pWH-ctx.lineWidth);
            }else if(state.currentTool==='bulldoze'){/* ... Bulldoze preview unchanged ... */ let eX=mouseGridX;let eY=mouseGridY;let tS=1;const tD=state.gridData.get(`${eX},${eY}`);if(typeof tD==='object'&&tD!==null&&!tD.isOrigin){eX=tD.originX;eY=tD.originY;const mTD=state.gridData.get(`${eX},${eY}`);if(typeof mTD==='object'&&mTD!==null&&mTD.isOrigin){tS=mTD.size;}}else if(typeof tD==='object'&&tD!==null&&tD.isOrigin){tS=tD.size;}const eHX=eX*config.BASE_GRID_SIZE;const eHY=eY*config.BASE_GRID_SIZE;const eP=config.BASE_GRID_SIZE*tS;ctx.strokeStyle='rgba(255,0,0,0.8)';ctx.strokeRect(eHX+ctx.lineWidth/2,eHY+ctx.lineWidth/2,eP-ctx.lineWidth,eP-ctx.lineWidth);}
        }
    }
    ctx.restore();
}

// --- Game Loop --- (Unchanged)
function gameLoop(){updatePanningInput();render();requestAnimationFrame(gameLoop);}
// --- Start --- (Unchanged)
init();
