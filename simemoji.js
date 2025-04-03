import * as config from './config.js';
import * as state from './state.js';
import * as ui from './ui.js';
// Correct the import: Use getEffectiveTileInfo
import { loadGameFromFile, confirmClearSaveData, getEffectiveTileInfo } from './state.js';
import { drawGeneratedTile } from './drawingUtils.js';

// --- Game State ---
let currentGridSize = config.BASE_GRID_SIZE * state.zoomLevel;
let isLayerIsolationActive = false;
// Remove isolatedLayer state variable - we'll derive it from state.currentPlacementLayer when needed
// let isolatedLayer = config.DEFAULT_LAYER;

// --- Mouse State ---
let mouseScreenX = 0, mouseScreenY = 0; let mouseWorldX = 0, mouseWorldY = 0; let mouseGridX = 0, mouseGridY = 0;
let keys = {}; let isPanning = false; let panStartX = 0, panStartY = 0; let panStartCamX = 0, panStartCamY = 0;

// --- Initialization ---
function init() {
    ui.populatePalette(); setupCanvas(); addEventListeners();
    state.loadGameFromLocal();
    updateCurrentGridSize(); clampCamera();
    // UI updates after loading state
    ui.selectTile(state.selectedTile); // Sets tile and currentPlacementLayer
    ui.updateSizeUI();
    // ui.updateLayerUI(); // No separate layer UI to update
    ui.updateToolUI(); ui.updateUndoRedoButtons();
    updateIsolationDisplay(); // Update isolation visual based on derived placement layer
    gameLoop(); console.log("SimEmoji v9 Initialized.");
}

function setupCanvas() { /* ... Unchanged ... */ }

// --- Event Handling Setup ---
function addEventListeners() {
    /* ... Keep existing listeners for canvas, resize, tools, slider, save/load/clear, zoom, undo/redo, keyboard ... */
    const canvas = document.getElementById('gameCanvas');
    window.addEventListener('resize', handleResize); canvas.addEventListener('mousemove', handleMouseMove); canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp); canvas.addEventListener('mouseout', handleMouseOut); canvas.addEventListener('wheel', handleMouseWheel, { passive: false });
    ui.buildToolBtn.addEventListener('click', () => ui.setTool('build')); ui.bulldozeToolBtn.addEventListener('click', () => ui.setTool('bulldoze'));
    ui.sizeSlider.addEventListener('input', () => ui.selectSize(parseInt(ui.sizeSlider.value, 10)));
    // ui.layerDownBtn/UpBtn listeners removed
    ui.saveFileBtn.addEventListener('click', state.saveGameToFile); ui.loadFileBtn.addEventListener('click', () => ui.fileInput.click());
    ui.fileInput.addEventListener('change', handleFileLoad); ui.clearSaveBtn.addEventListener('click', ui.showClearConfirmation);
    ui.clearConfirmYesBtn.addEventListener('click', () => { confirmClearSaveData(); ui.hideClearConfirmation(); }); // confirmClearSaveData now resets state
    ui.clearConfirmNoBtn.addEventListener('click', ui.hideClearConfirmation);
    ui.zoomInBtn.addEventListener('click', () => zoom(1 + config.ZOOM_INCREMENT)); ui.zoomOutBtn.addEventListener('click', () => zoom(1 / (1 + config.ZOOM_INCREMENT)));
    ui.undoBtn.addEventListener('click', state.undo); ui.redoBtn.addEventListener('click', state.redo);
    // ui.layerDisplay listener removed - no manual layer selection display to click
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    window.addEventListener('stateLoaded', handleStateLoaded);
}

// --- Layer Change / Isolation ---
// changeLayer function removed - layer is automatic

function toggleLayerIsolation() { // Keep isolation toggle logic
    isLayerIsolationActive = !isLayerIsolationActive;
    updateIsolationDisplay();
    const displayLayer = isLayerIsolationActive ? state.currentPlacementLayer : 'All';
    console.log(`Layer Isolation ${isLayerIsolationActive ? 'ON' : 'OFF'} (Layer: ${displayLayer})`);
}

function updateIsolationDisplay() {
    // We need a way to indicate isolation is on/off, maybe change background of UI panel?
    // Or add a dedicated indicator? For now, just log it.
    // ui.layerDisplay no longer exists for this purpose.
     const uiPanel = document.getElementById('uiPanel');
     if (isLayerIsolationActive) {
         uiPanel.style.borderLeft = '3px solid yellow'; // Example indicator
         console.log(`Isolation ON for Layer: ${state.currentPlacementLayer}`);
     } else {
         uiPanel.style.borderLeft = 'none';
     }
}

// --- Event Handlers ---
function handleResize() { /* ... */ }
function handleMouseMove(e) { /* ... */ }

function handleMouseDown(e) {
    // Panning... (Unchanged)
    if (e.button === 1 || (e.button === 0 && keys['Space'])) { /*...*/ return; }

    if (e.button === 0) {
        const size = state.selectedSize; const tool = state.currentTool;
        // *** Use the automatically determined placement layer ***
        const layerToPlaceOn = state.currentPlacementLayer;
        const originX = mouseGridX; const originY = mouseGridY;
        if (originX < 0 || originX + size > config.WORLD_WIDTH_CELLS || originY < 0 || originY + size > config.WORLD_HEIGHT_CELLS) return;

        const tileToPlace = state.selectedTile;
        const isGroundTile = config.GROUND_TILES.has(tileToPlace);
        const isPathTile = config.PATH_TILES.has(tileToPlace);

        // --- Layer Placement Rule Check --- (Unchanged - uses derived layerToPlaceOn)
        if (tool === 'build') {
            if (isGroundTile && layerToPlaceOn !== config.LAYER_GROUND) { ui.showStatusMessage("Ground tiles only on Layer 0!", false); return; }
            if (!isGroundTile && layerToPlaceOn === config.LAYER_GROUND) { ui.showStatusMessage("Cannot place non-ground on Layer 0!", false); return; }
            if (isPathTile && layerToPlaceOn !== config.LAYER_PATHS) { ui.showStatusMessage("Path tiles only on Layer 1!", false); return; }
        }
        // --- End Check ---


        // Bulldoze Logic (Uses getEffectiveTileInfo)
        if (tool === 'bulldoze') {
            // *** Use getEffectiveTileInfo to find the topmost object ***
            const objectToDelete = getEffectiveTileInfo(originX, originY);

            // If isolation is ON, only allow deleting if the object is on the isolated layer
            if (!objectToDelete || (isLayerIsolationActive && objectToDelete.layer !== state.currentPlacementLayer)) {
                console.log("Nothing to bulldoze on visible/target layer."); return;
            }

            const cellsToClear = [];
            // Iterate through the bounds of the object found
            for (let dx = 0; dx < objectToDelete.size; dx++) { for (let dy = 0; dy < objectToDelete.size; dy++) {
                const cX = objectToDelete.originX + dx; const cY = objectToDelete.originY + dy; const cK = `${cX},${cY}`;
                const currentLayerMap = state.gridData.get(cK);
                const oldDataForLayer = currentLayerMap ? (currentLayerMap[objectToDelete.layer] || null) : null; // Get data specifically for the object's layer

                if (oldDataForLayer !== null) {
                     // Calculate the new layer map after removing the item from its layer
                     const newLayerMap = { ...(currentLayerMap || {}) }; // Clone existing map or start empty
                     delete newLayerMap[objectToDelete.layer]; // Remove item from its layer

                    cellsToClear.push({
                        key: cK,
                        oldLayerMap: currentLayerMap || null, // Store the original map for undo
                        // If map becomes empty after deletion, store null, otherwise store the modified map
                        newLayerMap: Object.keys(newLayerMap).length === 0 ? null : newLayerMap
                    });
                }
            }}
            if (cellsToClear.length > 0) { state.performAction({ type: 'bulldoze', cells: cellsToClear }); }

        // Build Logic (Uses getEffectiveTileInfo for collision)
        } else if (tool === 'build' && tileToPlace) {
            let canPlace = true;
            const cellsToModify = []; // Store {key, oldLayerMap, newLayerMap}

            for (let dx = 0; dx < size; dx++) { for (let dy = 0; dy < size; dy++) {
                const cX = originX + dx; const cY = originY + dy; const cK = `${cX},${cY}`;
                // *** Use getEffectiveTileInfo to check for collision on the target layer ***
                const existingInfo = getEffectiveTileInfo(cX, cY); // Checks topmost

                // --- Collision Check ---
                if (existingInfo && existingInfo.layer >= layerToPlaceOn) {
                    // Allow replacing ONLY ground-on-ground or path-on-path
                    if (!((layerToPlaceOn === config.LAYER_GROUND && existingInfo.layer === config.LAYER_GROUND && isGroundTile) ||
                          (layerToPlaceOn === config.LAYER_PATHS && existingInfo.layer === config.LAYER_PATHS && isPathTile)))
                    {
                        canPlace = false; console.log(`Placement blocked at ${cX},${cY} by existing layer ${existingInfo.layer}`); break;
                    }
                }
                // --- End Collision Check ---

                // Prepare modification data
                const currentLayerMap = state.gridData.get(cK);
                const newDataForLayer = (dx === 0 && dy === 0)
                    ? { tile: tileToPlace, size: size, isOrigin: true } // Don't store layer *in* the object data anymore
                    : { originX: originX, originY: originY, isOrigin: false };

                // Create the new layer map for this cell
                const newLayerMap = { ...(currentLayerMap || {}) }; // Clone existing or start empty
                newLayerMap[layerToPlaceOn] = newDataForLayer; // Add/overwrite data for the placement layer

                cellsToModify.push({ key: cK, oldLayerMap: currentLayerMap || null, newLayerMap: newLayerMap });

            } if (!canPlace) break; }

            if (canPlace) {
                 // Check identical placement (Simplified check - does this exact object exist on this layer already?)
                 const originInfo = getEffectiveTileInfo(originX, originY); let isIdentical = false;
                 if (originInfo && originInfo.isOrigin && originInfo.tile === tileToPlace && originInfo.size === size && originInfo.layer === layerToPlaceOn) { isIdentical = true; }

                 if (!isIdentical) { state.performAction({type:'place', cells:cellsToModify}); }
                 else { console.log("Identical placement skipped."); }
            } else { ui.showStatusMessage("Placement blocked", false); }
        }
    }
}
function handleMouseUp(e) { /* ... Unchanged ... */ }
function handleMouseOut() { /* ... Unchanged ... */ }
function handleMouseWheel(e) { /* ... Unchanged ... */ }
function handleKeyDown(e) { // Updated shortcuts
    keys[e.code]=true;
    if(e.ctrlKey||e.metaKey){
        if(e.code==='KeyZ'){e.preventDefault();state.undo();}
        else if(e.code==='KeyY'){e.preventDefault();state.redo();}
        else if(e.code==='KeyS'){e.preventDefault();state.saveGameToFile();}
        else if(e.code==='KeyO'){e.preventDefault();ui.fileInput.click();}
    } else {
        if(e.code==='KeyB')ui.setTool('build');
        if(e.code==='KeyX')ui.setTool('bulldoze');
        if(e.code==='Equal'||e.code==='NumpadAdd')zoom(1+config.ZOOM_INCREMENT);
        if(e.code==='Minus'||e.code==='NumpadSubtract')zoom(1/(1+config.ZOOM_INCREMENT));
        // Removed layer change shortcuts , .
        if(e.code === 'KeyL') toggleLayerIsolation(); // Keep isolation toggle
        // Add size shortcuts?
        // if(e.code.startsWith('Digit')) { const size = parseInt(e.code.replace('Digit','')); if(size >= 1 && size <= config.MAX_BUILD_SIZE) ui.selectSize(size); }
    }
}
function handleFileLoad(event) { /* ... Unchanged ... */ }
function handleStateLoaded() { // Update isolation display on load/clear
    console.log("Reacting to stateLoaded event");
    updateCurrentGridSize(); clampCamera();
    ui.updateSizeUI();
    // ui.updateLayerUI(); // Removed
    updateIsolationDisplay(); // Update isolation visual
}

// --- Core Engine Logic --- (Unchanged)
function updateCurrentGridSize() { currentGridSize = config.BASE_GRID_SIZE * state.zoomLevel; }
function clampCamera() { /* ... */ } function zoom(factor, pivotX, pivotY) { /* ... */ } function updatePanningInput() { /* ... */ }

// --- Rendering --- (Iterates through layers within each cell)
function render() {
    const canvas = document.getElementById('gameCanvas'); const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#5a8b5a'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.save();
    ctx.translate(-state.camX * state.zoomLevel, -state.camY * state.zoomLevel); ctx.scale(state.zoomLevel, state.zoomLevel);

    // Visible range... (Unchanged)
    const viewLeftWorld=state.camX; const viewTopWorld=state.camY; const viewRightWorld=state.camX+canvas.width/state.zoomLevel; const viewBottomWorld=state.camY+canvas.height/state.zoomLevel; const startGridX=Math.floor(viewLeftWorld/config.BASE_GRID_SIZE)-1; const endGridX=Math.ceil(viewRightWorld/config.BASE_GRID_SIZE)+1; const startGridY=Math.floor(viewTopWorld/config.BASE_GRID_SIZE)-1; const endGridY=Math.ceil(viewBottomWorld/config.BASE_GRID_SIZE)+1;

    // Draw Grid... (Unchanged)
    ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=1/state.zoomLevel; for(let x=startGridX;x<=endGridX;x++){const wx=x*config.BASE_GRID_SIZE; ctx.beginPath();ctx.moveTo(wx,startGridY*config.BASE_GRID_SIZE);ctx.lineTo(wx,endGridY*config.BASE_GRID_SIZE);ctx.stroke();} for(let y=startGridY;y<=endGridY;y++){const wy=y*config.BASE_GRID_SIZE; ctx.beginPath();ctx.moveTo(startGridX*config.BASE_GRID_SIZE,wy);ctx.lineTo(endGridX*config.BASE_GRID_SIZE,wy);ctx.stroke();}

    // --- Prepare Render List ---
    const renderList = []; const baseTileFontSize = config.BASE_GRID_SIZE*0.8; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const drawnOrigins = new Set(); // Keep track of drawn multi-tile origins

    for (let gx = startGridX; gx < endGridX; gx++) { for (let gy = startGridY; gy < endGridY; gy++) {
        if(gx<0||gx>=config.WORLD_WIDTH_CELLS||gy<0||gy>=config.WORLD_HEIGHT_CELLS) continue;
        const key = `${gx},${gy}`;
        const layerMap = state.gridData.get(key);
        if (!layerMap) continue; // Skip empty coordinates

        // Iterate through layers present at this coordinate, lowest first
        const layers = Object.keys(layerMap).map(Number).sort((a, b) => a - b);

        for (const layer of layers) {
            // --- Layer Isolation Filter ---
            if (isLayerIsolationActive && layer !== state.currentPlacementLayer) {
                 continue; // Skip drawing if isolation ON and layer doesn't match placement layer
            }
            // --- End Isolation Filter ---

            const tileData = layerMap[layer];
            let tileIdToRender = null; let itemSize = 1; let isOrigin = false; let originX = gx; let originY = gy;
            let worldX = 0, worldY = 0, worldYBottom = 0; let itemFontSize = baseTileFontSize; let isGenerated = false;

            if (typeof tileData === 'string') {
                tileIdToRender = tileData; itemSize = 1; isOrigin = true; originX = gx; originY = gy;
            } else if (typeof tileData === 'object' && tileData !== null) {
                if (tileData.isOrigin) {
                    tileIdToRender = tileData.tile; itemSize = tileData.size || 1; isOrigin = true; originX = gx; originY = gy;
                } else { // It's a part - we need the origin info to draw correctly
                    const originKey = `${tileData.originX},${tileData.originY}`;
                    const originLayerMap = state.gridData.get(originKey);
                    const originData = originLayerMap ? originLayerMap[layer] : null; // Origin must be on same layer
                    if (originData?.isOrigin) {
                        tileIdToRender = originData.tile; itemSize = originData.size || 1; isOrigin = false; // It's a part
                        originX = tileData.originX; originY = tileData.originY; // Store ref to origin
                    } else {
                         continue; // Skip orphaned part
                    }
                }
            }

            if (tileIdToRender !== null) {
                isGenerated = config.GENERATED_TILE_IDS.has(tileIdToRender);
                itemFontSize = baseTileFontSize * (itemSize * 0.8); // Scale font size
                const objectWorldWidth = config.BASE_GRID_SIZE * itemSize; const objectWorldHeight = config.BASE_GRID_SIZE * itemSize;
                // Calculate position based on the OBJECT'S origin (originX, originY)
                worldX = originX * config.BASE_GRID_SIZE + objectWorldWidth / 2;
                worldY = originY * config.BASE_GRID_SIZE + objectWorldHeight / 2;
                worldYBottom = (originY + itemSize) * config.BASE_GRID_SIZE; // Y-sort based on origin's bottom

                // --- Add to list ONLY IF IT'S THE ORIGIN ---
                // We iterate cell by cell, layer by layer, but only add the object representation ONCE
                // when we encounter its origin cell on its layer.
                 const originId = `${originX},${originY},${layer}`; // Unique ID for object instance on a layer
                 if (isOrigin && !drawnOrigins.has(originId)) {
                    renderList.push({ tile: tileIdToRender, x: worldX, y: worldY, size: itemSize, layer: layer, fontSize: itemFontSize, worldYBottom: worldYBottom, isGenerated: isGenerated, originGx: originX, originGy: originY });
                    drawnOrigins.add(originId); // Mark this origin on this layer as processed
                 }
                 // If it's just a string (simple tile), isOrigin is true, size is 1, always add.
                 else if (typeof tileData === 'string' && !drawnOrigins.has(originId)) {
                     renderList.push({ tile: tileIdToRender, x: worldX, y: worldY, size: itemSize, layer: layer, fontSize: itemFontSize, worldYBottom: worldYBottom, isGenerated: isGenerated, originGx: originX, originGy: originY });
                    drawnOrigins.add(originId);
                 }
            }
        } // End layer loop
    }} // End grid loops

    // Sort Render List (by layer, then Y-bottom)
    renderList.sort((a,b)=>{if(a.layer!==b.layer)return a.layer-b.layer; return a.worldYBottom-b.worldYBottom;});

    // Draw Sorted List
    renderList.forEach(item=>{if(item.isGenerated){const dX=item.x-(config.BASE_GRID_SIZE*item.size)/2; const dY=item.y-(config.BASE_GRID_SIZE*item.size)/2; drawGeneratedTile(ctx,dX,dY,config.BASE_GRID_SIZE*item.size,item.tile);}else{ctx.font=`${item.fontSize}px sans-serif`; ctx.fillText(item.tile,item.x,item.y);}});
    ctx.font = `${baseTileFontSize}px sans-serif`; // Reset

    // Draw Preview... (Validity check adjusted for new layer logic)
     if (mouseGridX >= 0 && mouseGridY >= 0 && mouseScreenX >= 0 && mouseScreenY >= 0 && mouseScreenX <= canvas.width && mouseScreenY <= canvas.height){
        const hoverSize=state.currentTool==='build'?state.selectedSize:1; const hEndX=mouseGridX+hoverSize; const hEndY=mouseGridY+hoverSize;
        if(hEndX<=config.WORLD_WIDTH_CELLS&&hEndY<=config.WORLD_HEIGHT_CELLS){
            const hWX=mouseGridX*config.BASE_GRID_SIZE; const hWY=mouseGridY*config.BASE_GRID_SIZE; const pWW=config.BASE_GRID_SIZE*hoverSize; const pWH=config.BASE_GRID_SIZE*hoverSize; ctx.lineWidth=2/state.zoomLevel;
            if(state.currentTool==='build'&&state.selectedTile){
                let canPlacePreview=true; const pLayer=state.currentPlacementLayer; const isPGround=config.GROUND_TILES.has(state.selectedTile); const isPPath=config.PATH_TILES.has(state.selectedTile);
                if(pLayer===config.LAYER_GROUND&&!isPGround)canPlacePreview=false; if(pLayer>config.LAYER_GROUND&&isPGround)canPlacePreview=false; if(isPPath&&pLayer!==config.LAYER_PATHS)canPlacePreview=false;
                if(canPlacePreview){for(let dx=0;dx<hoverSize;dx++){for(let dy=0;dy<hoverSize;dy++){ const cX=mouseGridX+dx;const cY=mouseGridY+dy; const eInfo=getEffectiveTileInfo(cX,cY); // Check topmost
                    if(eInfo && pLayer<=eInfo.layer){ if(!((pLayer===config.LAYER_PATHS&&eInfo.layer===config.LAYER_GROUND)||(pLayer===config.LAYER_FEATURES&&eInfo.layer<=config.LAYER_PATHS)||(pLayer===config.LAYER_BUILDINGS&&eInfo.layer<=config.LAYER_FEATURES)||(pLayer===config.LAYER_AIR&&eInfo.layer<=config.LAYER_BUILDINGS))){canPlacePreview=false;break;}} // Check exceptions
                }if(!canPlacePreview)break;}} // Validity check end

                ctx.globalAlpha=0.5; const pFS=baseTileFontSize*(hoverSize*0.8); ctx.font=`${pFS}px sans-serif`;
                if(config.GENERATED_TILE_IDS.has(state.selectedTile)){const pDX=hWX;const pDY=hWY;drawGeneratedTile(ctx,pDX,pDY,pWW,state.selectedTile);}else{ctx.fillText(state.selectedTile,hWX+pWW/2,hWY+pWH/2);}
                ctx.globalAlpha=1.0; ctx.font=`${baseTileFontSize}px sans-serif`; ctx.strokeStyle=canPlacePreview?'rgba(0,255,0,0.8)':'rgba(255,0,0,0.8)'; ctx.strokeRect(hWX+ctx.lineWidth/2,hWY+ctx.lineWidth/2,pWW-ctx.lineWidth,pWH-ctx.lineWidth);
            }else if(state.currentTool==='bulldoze'){ let eX=mouseGridX;let eY=mouseGridY;let tS=1;const tInfo=getEffectiveTileInfo(eX,eY);if(tInfo){eX=tInfo.originX;eY=tInfo.originY;tS=tInfo.size;} const eHX=eX*config.BASE_GRID_SIZE;const eHY=eY*config.BASE_GRID_SIZE;const eP=config.BASE_GRID_SIZE*tS;ctx.strokeStyle='rgba(255,0,0,0.8)';ctx.strokeRect(eHX+ctx.lineWidth/2,eHY+ctx.lineWidth/2,eP-ctx.lineWidth,eP-ctx.lineWidth);}
        }
    }
    ctx.restore();
}

// --- Game Loop ---
function gameLoop(){ updatePanningInput(); render(); requestAnimationFrame(gameLoop); }
// --- Start ---
init();
