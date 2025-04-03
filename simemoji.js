import * as config from './config.js';
import * as state from './state.js';
import * as ui from './ui.js';
import { loadGameFromFile, confirmClearSaveData, getTileInfo } from './state.js';
import { drawGeneratedTile } from './drawingUtils.js';

// --- Game State ---
let currentGridSize = config.BASE_GRID_SIZE * state.zoomLevel;
let isLayerIsolationActive = false;
let isolatedLayer = config.DEFAULT_LAYER; // Store the isolated layer #

// --- Mouse State ---
let mouseScreenX = 0, mouseScreenY = 0;
let mouseWorldX = 0, mouseWorldY = 0;
let mouseGridX = 0, mouseGridY = 0;
let keys = {};
let isPanning = false;
let panStartX = 0, panStartY = 0;
let panStartCamX = 0, panStartCamY = 0;

// --- Initialization ---
function init() {
    ui.populatePalette();
    setupCanvas();
    addEventListeners();
    state.loadGameFromLocal(); // Load state first
    // Update engine/UI based on loaded/default state
    updateCurrentGridSize();
    clampCamera();
    ui.selectTile(state.selectedTile); // This also sets the default layer based on the tile
    ui.updateSizeUI(); // Reflects loaded/default size
    ui.updateLayerUI(); // Reflects loaded/default layer (potentially overridden by selectTile)
    ui.updateToolUI();
    ui.updateUndoRedoButtons();
    isolatedLayer = state.selectedLayer; // Sync isolation view with current layer initially
    updateIsolationDisplay();
    gameLoop();
    console.log("SimEmoji v8 Initialized.");
}

function setupCanvas() {
    const canvasContainer = document.getElementById('canvasContainer');
    const canvas = document.getElementById('gameCanvas');
    canvas.width = canvasContainer.offsetWidth;
    canvas.height = canvasContainer.offsetHeight;
    // Consider enabling image smoothing ONLY if pixelated emojis look bad at zoom
    // const ctx = canvas.getContext('2d');
    // ctx.imageSmoothingEnabled = true; // or false
}

// --- Event Handling Setup ---
function addEventListeners() {
    const canvas = document.getElementById('gameCanvas');
    window.addEventListener('resize', handleResize);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseout', handleMouseOut);
    canvas.addEventListener('wheel', handleMouseWheel, { passive: false });

    // Tools
    ui.buildToolBtn.addEventListener('click', () => ui.setTool('build'));
    ui.bulldozeToolBtn.addEventListener('click', () => ui.setTool('bulldoze'));
    // Size Slider
    ui.sizeSlider.addEventListener('input', () => ui.selectSize(parseInt(ui.sizeSlider.value, 10)));
    // Layers
    ui.layerDownBtn.addEventListener('click', () => changeLayer(-1));
    ui.layerUpBtn.addEventListener('click', () => changeLayer(1));
    ui.layerDisplay.addEventListener('click', toggleLayerIsolation); // Layer number SPAN is the toggle
    ui.layerDisplay.style.cursor = 'pointer';
    ui.layerDisplay.title = 'Click to toggle layer isolation';
    // Save/Load/Clear
    ui.saveFileBtn.addEventListener('click', state.saveGameToFile);
    ui.loadFileBtn.addEventListener('click', () => ui.fileInput.click());
    ui.fileInput.addEventListener('change', handleFileLoad);
    ui.clearSaveBtn.addEventListener('click', ui.showClearConfirmation);
    ui.clearConfirmYesBtn.addEventListener('click', () => {
        // confirmClearSaveData now resets state and triggers 'stateLoaded'
        confirmClearSaveData();
        ui.hideClearConfirmation();
    });
    ui.clearConfirmNoBtn.addEventListener('click', ui.hideClearConfirmation);
    // Zoom
    ui.zoomInBtn.addEventListener('click', () => zoom(1 + config.ZOOM_INCREMENT));
    ui.zoomOutBtn.addEventListener('click', () => zoom(1 / (1 + config.ZOOM_INCREMENT)));
    // Undo/Redo
    ui.undoBtn.addEventListener('click', state.undo);
    ui.redoBtn.addEventListener('click', state.redo);
    // Keyboard
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    // State Loaded
    window.addEventListener('stateLoaded', handleStateLoaded); // For load and clear reset
}

// --- Layer Change Helper ---
function changeLayer(delta) {
    const currentLayer = state.selectedLayer;
    let newLayer = currentLayer + delta;
    newLayer = Math.max(config.MIN_LAYER, Math.min(newLayer, config.MAX_LAYER)); // Clamp
    ui.selectLayer(newLayer); // Update state and UI display number

    // If isolation is active, also change the isolated layer
    if (isLayerIsolationActive) {
        isolatedLayer = newLayer;
        updateIsolationDisplay(); // Update visual feedback (border/bg)
    }
}

// --- Layer Isolation ---
function toggleLayerIsolation() {
    isLayerIsolationActive = !isLayerIsolationActive;
    if (isLayerIsolationActive) {
        isolatedLayer = state.selectedLayer; // Isolate current on activation
    }
    updateIsolationDisplay(); // Update border/bg and tooltip
    console.log(`Layer Isolation ${isLayerIsolationActive ? 'ON' : 'OFF'} (Layer: ${isolatedLayer})`);
}

function updateIsolationDisplay() {
    const displayElement = ui.layerDisplay;
    // Always display the currently selected layer number
    displayElement.textContent = state.selectedLayer;
    if (isLayerIsolationActive) {
        displayElement.style.border = '1px solid yellow';
        displayElement.style.backgroundColor = 'rgba(255, 255, 0, 0.2)';
        displayElement.title = `Isolating Layer ${isolatedLayer} (Click to toggle OFF)`;
    } else {
        displayElement.style.border = 'none'; // Use theme border or none
        displayElement.style.backgroundColor = 'transparent';
        displayElement.title = 'Click to toggle layer isolation';
    }
}


// --- Event Handlers ---
function handleResize() {
    setupCanvas();
    clampCamera(); // Re-clamp camera on resize
}

function handleMouseMove(e) {
    const canvas = document.getElementById('gameCanvas');
    const rect = canvas.getBoundingClientRect();
    mouseScreenX = e.clientX - rect.left;
    mouseScreenY = e.clientY - rect.top;

    mouseWorldX = (mouseScreenX / state.zoomLevel) + state.camX;
    mouseWorldY = (mouseScreenY / state.zoomLevel) + state.camY;
    mouseGridX = Math.floor(mouseWorldX / config.BASE_GRID_SIZE);
    mouseGridY = Math.floor(mouseWorldY / config.BASE_GRID_SIZE);

    ui.updateCoordsDisplay(mouseGridX, mouseGridY);

    if (isPanning) {
        const dx = (mouseScreenX - panStartX) / state.zoomLevel;
        const dy = (mouseScreenY - panStartY) / state.zoomLevel;
        state.setCamPos(panStartCamX - dx, panStartCamY - dy);
        clampCamera();
    }
}

function handleMouseDown(e) {
    const canvas = document.getElementById('gameCanvas');
    // Panning
    if (e.button === 1 || (e.button === 0 && keys['Space'])) {
        isPanning = true; panStartX = mouseScreenX; panStartY = mouseScreenY;
        panStartCamX = state.camX; panStartCamY = state.camY;
        canvas.style.cursor = 'grabbing'; e.preventDefault(); return;
    }

    // Tool Interaction
    if (e.button === 0) {
        const size = state.selectedSize; const tool = state.currentTool; const layerToPlaceOn = state.selectedLayer;
        const originX = mouseGridX; const originY = mouseGridY;
        if (originX < 0 || originX + size > config.WORLD_WIDTH_CELLS || originY < 0 || originY + size > config.WORLD_HEIGHT_CELLS) return;

        const tileToPlace = state.selectedTile;
        const isGroundTile = config.GROUND_TILES.has(tileToPlace);
        const isPathTile = config.PATH_TILES.has(tileToPlace);

        // --- Layer Placement Rule Check ---
        if (tool === 'build') {
            if (isGroundTile && layerToPlaceOn !== config.LAYER_GROUND) { ui.showStatusMessage("Ground tiles only on Layer 0!", false); return; }
            if (!isGroundTile && layerToPlaceOn === config.LAYER_GROUND) { ui.showStatusMessage("Cannot place non-ground on Layer 0!", false); return; }
            if (isPathTile && layerToPlaceOn !== config.LAYER_PATHS) { ui.showStatusMessage("Path tiles only on Layer 1!", false); return; }
            // If placing paths, ensure ground exists underneath? Optional, complex.
            // if (isPathTile) {
            //     const groundInfo = getTileInfo(originX, originY); // Check base layer only?
            //     if (!groundInfo || groundInfo.layer !== config.LAYER_GROUND) { ui.showStatusMessage("Paths require ground!", false); return; }
            // }
        }
        // --- End Layer Placement Rule Check ---


        // Bulldoze Logic (Find topmost visible object at click point)
        if (tool === 'bulldoze') {
            let topTileInfo = null;
            // Iterate down from max layer to find the first object at the click coords
            // Consider isolation mode
            const startLayer = isLayerIsolationActive ? isolatedLayer : config.MAX_LAYER;
            const endLayer = isLayerIsolationActive ? isolatedLayer : config.MIN_LAYER;

            // This simple check only finds objects *originating* at gx,gy.
            // We need to check if gx,gy is *covered* by any object.
            let objectToDelete = null;
            let highestLayerFound = -Infinity;

            for (let layer = startLayer; layer >= endLayer; layer--) {
                 // Check potential origins that could cover gx,gy
                 for (let s = config.MAX_BUILD_SIZE; s >= 1; s--) { // Check larger sizes first
                     for (let ox = originX - s + 1; ox <= originX; ox++) {
                         for (let oy = originY - s + 1; oy <= originY; oy++) {
                              if (ox < 0 || oy < 0) continue; // Origin out of bounds lower left

                             const potentialOriginInfo = getTileInfo(ox, oy);
                             if (potentialOriginInfo && potentialOriginInfo.isOrigin && potentialOriginInfo.layer === layer && potentialOriginInfo.size >= s) {
                                 // Check if the bounds actually cover the clicked cell
                                 if (originX >= ox && originX < ox + potentialOriginInfo.size &&
                                     originY >= oy && originY < oy + potentialOriginInfo.size)
                                 {
                                     // Found the covering object on this layer
                                     if (layer > highestLayerFound) { // Is it the topmost found so far?
                                         objectToDelete = potentialOriginInfo;
                                         highestLayerFound = layer;
                                         // Optimization: Can break inner loops once found on this layer? Only if not searching for partial overlaps.
                                     }
                                 }
                             }
                         }
                     }
                 }
                 if (objectToDelete && highestLayerFound === layer) break; // Found topmost, stop searching lower layers
            }


            if (!objectToDelete) {
                console.log("Nothing to bulldoze on visible/target layer.");
                return;
            }

            // We have the objectToDelete (which includes its originX, originY, and size)
            const cellsToClear = [];
            for (let dx = 0; dx < objectToDelete.size; dx++) { for (let dy = 0; dy < objectToDelete.size; dy++) {
                const cX=objectToDelete.originX+dx; const cY=objectToDelete.originY+dy; const cK=`${cX},${cY}`;
                const old = state.gridData.get(cK) || null;
                // Ensure we only target cells belonging to the specific object identified
                const currentInfo = getTileInfo(cX, cY);
                if (old !== null && currentInfo && currentInfo.originX === objectToDelete.originX && currentInfo.originY === objectToDelete.originY) {
                     cellsToClear.push({key:cK, oldData:old, newData:null});
                }
            }}
            if (cellsToClear.length > 0) { state.performAction({ type: 'bulldoze', cells: cellsToClear }); }

        // Build Logic (Collision check refined)
        } else if (tool === 'build' && tileToPlace) {
            let canPlace = true;
            const cellsToModify = []; // Store {key, oldData, newData}

            for (let dx = 0; dx < size; dx++) { for (let dy = 0; dy < size; dy++) {
                const cX = originX + dx; const cY = originY + dy; const cK = `${cX},${cY}`;
                const existingInfo = getTileInfo(cX, cY); // Get processed info for the cell

                // --- Collision Check ---
                if (existingInfo) {
                    // Block if placing ON OR BELOW an existing object's layer
                    if (layerToPlaceOn <= existingInfo.layer) {
                        // Allow replacing ground with ground, paths with paths ON THEIR LAYER
                        if (!((layerToPlaceOn === config.LAYER_GROUND && existingInfo.layer === config.LAYER_GROUND && isGroundTile) ||
                              (layerToPlaceOn === config.LAYER_PATHS && existingInfo.layer === config.LAYER_PATHS && isPathTile)))
                        {
                             canPlace = false; // Blocked!
                             console.log(`Placement blocked at ${cX},${cY} by existing layer ${existingInfo.layer}`);
                             break;
                        }
                         // If replacement is allowed, we still need the old data for undo
                    }
                     // If placing *above* existing, it's fine, rendering handles overlap.
                }
                // --- End Collision Check ---

                // Store potential change (use raw existing data for oldData)
                const rawExistingData = state.gridData.get(cK) || null;
                cellsToModify.push({ key: cK, oldData: rawExistingData, newData: (dx === 0 && dy === 0) ? { tile: tileToPlace, size: size, layer: layerToPlaceOn, isOrigin: true } : { originX: originX, originY: originY, layer: layerToPlaceOn, isOrigin: false } });

            } if (!canPlace) break; } // Break outer loop if blocked

            if (canPlace) {
                // Check identical placement...
                const originInfo = getTileInfo(originX, originY); let isIdentical = false;
                if (originInfo && originInfo.isOrigin && originInfo.tile === tileToPlace && originInfo.size === size && originInfo.layer === layerToPlaceOn) { isIdentical = true; }

                if (!isIdentical) { state.performAction({type:'place', cells:cellsToModify}); }
                else { console.log("Identical placement skipped."); }
            } else { ui.showStatusMessage("Placement blocked", false); }
        }
    }
}
function handleMouseUp(e) { /* ... Unchanged ... */ if (e.button === 1 || (e.button === 0 && isPanning)) { isPanning = false; document.getElementById('gameCanvas').style.cursor = 'crosshair'; } }
function handleMouseOut() { /* ... Unchanged ... */ if (isPanning) { isPanning = false; document.getElementById('gameCanvas').style.cursor = 'crosshair'; } mouseGridX = -1; mouseGridY = -1; ui.updateCoordsDisplay(-1, -1); }
function handleMouseWheel(e) { /* ... Unchanged ... */ e.preventDefault(); const z = e.deltaY < 0 ? (1 + config.ZOOM_INCREMENT) : (1 / (1 + config.ZOOM_INCREMENT)); zoom(z, mouseScreenX, mouseScreenY); }
function handleKeyDown(e) { /* ... Unchanged ... */ keys[e.code]=true;if(e.ctrlKey||e.metaKey){if(e.code==='KeyZ'){e.preventDefault();state.undo();}else if(e.code==='KeyY'){e.preventDefault();state.redo();}else if(e.code==='KeyS'){e.preventDefault();state.saveGameToFile();}else if(e.code==='KeyO'){e.preventDefault();ui.fileInput.click();}}else{if(e.code==='KeyB')ui.setTool('build');if(e.code==='KeyX')ui.setTool('bulldoze');if(e.code==='Equal'||e.code==='NumpadAdd')zoom(1+config.ZOOM_INCREMENT);if(e.code==='Minus'||e.code==='NumpadSubtract')zoom(1/(1+config.ZOOM_INCREMENT));if(e.code==='Comma')changeLayer(-1);if(e.code==='Period')changeLayer(1);if(e.code==='KeyL')toggleLayerIsolation();}}
function handleFileLoad(event) { /* ... Unchanged ... */ const file = event.target.files[0]; loadGameFromFile(file); event.target.value = null; }
function handleStateLoaded() { /* ... Unchanged ... */ console.log("Reacting to stateLoaded event"); updateCurrentGridSize(); clampCamera(); ui.updateSizeUI(); ui.updateLayerUI(); updateIsolationDisplay(); }

// --- Core Engine Logic --- (Unchanged)
function updateCurrentGridSize() { currentGridSize = config.BASE_GRID_SIZE * state.zoomLevel; }
function clampCamera() { const c=document.getElementById('gameCanvas'); const wpw=config.WORLD_WIDTH_CELLS*config.BASE_GRID_SIZE; const wph=config.WORLD_HEIGHT_CELLS*config.BASE_GRID_SIZE; const vww=c.width/state.zoomLevel; const vwh=c.height/state.zoomLevel; let nX=state.camX; let nY=state.camY; nX=Math.max(0,Math.min(nX,wpw-vww)); nY=Math.max(0,Math.min(nY,wph-vwh)); if(wpw<vww) nX=(wpw-vww)/2; if(wph<vwh) nY=(wph-vwh)/2; state.setCamPos(nX, nY); }
function zoom(factor, pivotX, pivotY) { const c=document.getElementById('gameCanvas'); pivotX=pivotX??c.width/2; pivotY=pivotY??c.height/2; const nZ=Math.max(config.MIN_ZOOM,Math.min(config.MAX_ZOOM,state.zoomLevel*factor)); if(nZ===state.zoomLevel)return; const wX=(pivotX/state.zoomLevel)+state.camX; const wY=(pivotY/state.zoomLevel)+state.camY; state.setZoomLevel(nZ); updateCurrentGridSize(); const nCX=wX-(pivotX/nZ); const nCY=wY-(pivotY/nZ); state.setCamPos(nCX, nCY); clampCamera(); }
function updatePanningInput() { let dx=0; let dy=0; const pA=config.PAN_SPEED_FACTOR*config.BASE_GRID_SIZE; if(keys['ArrowLeft']||keys['KeyA'])dx-=pA; if(keys['ArrowRight']||keys['KeyD'])dx+=pA; if(keys['ArrowUp']||keys['KeyW'])dy-=pA; if(keys['ArrowDown']||keys['KeyS'])dy+=pA; if(dx!==0||dy!==0){state.setCamPos(state.camX+dx,state.camY+dy); clampCamera();} }

// --- Rendering --- (Logic remains same, relies on getTileInfo)
function render() {
    const canvas = document.getElementById('gameCanvas'); const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#5a8b5a'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.save();
    ctx.translate(-state.camX * state.zoomLevel, -state.camY * state.zoomLevel); ctx.scale(state.zoomLevel, state.zoomLevel);

    // Visible range... (Unchanged)
    const viewLeftWorld=state.camX; const viewTopWorld=state.camY; const viewRightWorld=state.camX+canvas.width/state.zoomLevel; const viewBottomWorld=state.camY+canvas.height/state.zoomLevel; const startGridX=Math.floor(viewLeftWorld/config.BASE_GRID_SIZE)-1; const endGridX=Math.ceil(viewRightWorld/config.BASE_GRID_SIZE)+1; const startGridY=Math.floor(viewTopWorld/config.BASE_GRID_SIZE)-1; const endGridY=Math.ceil(viewBottomWorld/config.BASE_GRID_SIZE)+1;

    // Draw Grid... (Unchanged)
    ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=1/state.zoomLevel; for(let x=startGridX;x<=endGridX;x++){const wx=x*config.BASE_GRID_SIZE; ctx.beginPath();ctx.moveTo(wx,startGridY*config.BASE_GRID_SIZE);ctx.lineTo(wx,endGridY*config.BASE_GRID_SIZE);ctx.stroke();} for(let y=startGridY;y<=endGridY;y++){const wy=y*config.BASE_GRID_SIZE; ctx.beginPath();ctx.moveTo(startGridX*config.BASE_GRID_SIZE,wy);ctx.lineTo(endGridX*config.BASE_GRID_SIZE,wy);ctx.stroke();}

    // Prepare Render List (Uses getTileInfo)
    const renderList = []; const baseTileFontSize = config.BASE_GRID_SIZE*0.8; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let gx = startGridX; gx < endGridX; gx++) { for (let gy = startGridY; gy < endGridY; gy++) {
        if(gx<0||gx>=config.WORLD_WIDTH_CELLS||gy<0||gy>=config.WORLD_HEIGHT_CELLS) continue;
        const tileInfo = getTileInfo(gx, gy); // Use helper function
        if (!tileInfo) continue;

        // --- Layer Isolation Filter ---
        if (isLayerIsolationActive && tileInfo.layer !== isolatedLayer) continue;
        // --- End Isolation Filter ---

        // Add to render list ONLY if it's the origin (getTileInfo returns origin info even for parts, but marks isOrigin=false)
        // We only draw the object once from its origin cell's perspective in the loop
        if (tileInfo.isOrigin) {
             const itemSize = tileInfo.size; const itemLayer = tileInfo.layer; const tileIdToRender = tileInfo.tile;
             const isGenerated = config.GENERATED_TILE_IDS.has(tileIdToRender);
             const itemFontSize = baseTileFontSize * (itemSize * 0.8); // Scale font
             const objectWorldWidth = config.BASE_GRID_SIZE * itemSize; const objectWorldHeight = config.BASE_GRID_SIZE * itemSize;
             const worldX = gx * config.BASE_GRID_SIZE + objectWorldWidth / 2; // Use current gx, gy as origin
             const worldY = gy * config.BASE_GRID_SIZE + objectWorldHeight / 2;
             const worldYBottom = (gy + itemSize) * config.BASE_GRID_SIZE; // Bottom edge based on origin gy

            renderList.push({ tile: tileIdToRender, x: worldX, y: worldY, size: itemSize, layer: itemLayer, fontSize: itemFontSize, worldYBottom: worldYBottom, isGenerated: isGenerated });
        }
    }}

    // Sort Render List (Unchanged)
    renderList.sort((a,b)=>{if(a.layer!==b.layer)return a.layer-b.layer; return a.worldYBottom-b.worldYBottom;});

    // Draw Sorted List (Unchanged)
    renderList.forEach(item=>{if(item.isGenerated){const dX=item.x-(config.BASE_GRID_SIZE*item.size)/2; const dY=item.y-(config.BASE_GRID_SIZE*item.size)/2; drawGeneratedTile(ctx,dX,dY,config.BASE_GRID_SIZE*item.size,item.tile);}else{ctx.font=`${item.fontSize}px sans-serif`; ctx.fillText(item.tile,item.x,item.y);}});
    ctx.font = `${baseTileFontSize}px sans-serif`; // Reset

    // Draw Preview... (Validity check should be accurate now)
    if (mouseGridX >= 0 && mouseGridY >= 0 && mouseScreenX >= 0 && mouseScreenY >= 0 && mouseScreenX <= canvas.width && mouseScreenY <= canvas.height){
        const hoverSize=state.currentTool==='build'?state.selectedSize:1; const hEndX=mouseGridX+hoverSize; const hEndY=mouseGridY+hoverSize;
        if(hEndX<=config.WORLD_WIDTH_CELLS&&hEndY<=config.WORLD_HEIGHT_CELLS){
            const hWX=mouseGridX*config.BASE_GRID_SIZE; const hWY=mouseGridY*config.BASE_GRID_SIZE; const pWW=config.BASE_GRID_SIZE*hoverSize; const pWH=config.BASE_GRID_SIZE*hoverSize; ctx.lineWidth=2/state.zoomLevel;
            if(state.currentTool==='build'&&state.selectedTile){
                let canPlacePreview=true; const pLayer=state.selectedLayer; const isPGround=config.GROUND_TILES.has(state.selectedTile); const isPPath=config.PATH_TILES.has(state.selectedTile);
                if(pLayer===config.LAYER_GROUND&&!isPGround)canPlacePreview=false; if(pLayer>config.LAYER_GROUND&&isPGround)canPlacePreview=false; if(isPPath&&pLayer!==config.LAYER_PATHS)canPlacePreview=false;
                if(canPlacePreview){for(let dx=0;dx<hoverSize;dx++){for(let dy=0;dy<hoverSize;dy++){const cX=mouseGridX+dx;const cY=mouseGridY+dy;const eInfo=getTileInfo(cX,cY);
                    if(eInfo){ if(pLayer<=eInfo.layer){ if(!((pLayer===config.LAYER_PATHS&&eInfo.layer===config.LAYER_GROUND)||(pLayer===config.LAYER_FEATURES&&eInfo.layer<=config.LAYER_PATHS)||(pLayer===config.LAYER_BUILDINGS&&eInfo.layer<=config.LAYER_FEATURES)||(pLayer===config.LAYER_AIR&&eInfo.layer<=config.LAYER_BUILDINGS))){canPlacePreview=false;break;}}}
                }if(!canPlacePreview)break;}} // Validity check ends

                ctx.globalAlpha=0.5; const pFS=baseTileFontSize*(hoverSize*0.8); ctx.font=`${pFS}px sans-serif`;
                if(config.GENERATED_TILE_IDS.has(state.selectedTile)){const pDX=hWX;const pDY=hWY;drawGeneratedTile(ctx,pDX,pDY,pWW,state.selectedTile);}else{ctx.fillText(state.selectedTile,hWX+pWW/2,hWY+pWH/2);}
                ctx.globalAlpha=1.0; ctx.font=`${baseTileFontSize}px sans-serif`; ctx.strokeStyle=canPlacePreview?'rgba(0,255,0,0.8)':'rgba(255,0,0,0.8)'; ctx.strokeRect(hWX+ctx.lineWidth/2,hWY+ctx.lineWidth/2,pWW-ctx.lineWidth,pWH-ctx.lineWidth);
            }else if(state.currentTool==='bulldoze'){ /* Bulldoze preview uses getTileInfo */ let eX=mouseGridX;let eY=mouseGridY;let tS=1;const tInfo=getTileInfo(eX,eY);if(tInfo){eX=tInfo.originX;eY=tInfo.originY;tS=tInfo.size;} const eHX=eX*config.BASE_GRID_SIZE;const eHY=eY*config.BASE_GRID_SIZE;const eP=config.BASE_GRID_SIZE*tS;ctx.strokeStyle='rgba(255,0,0,0.8)';ctx.strokeRect(eHX+ctx.lineWidth/2,eHY+ctx.lineWidth/2,eP-ctx.lineWidth,eP-ctx.lineWidth);}
        }
    }
    ctx.restore();
}

// --- Game Loop ---
function gameLoop(){ updatePanningInput(); render(); requestAnimationFrame(gameLoop); }
// --- Start ---
init();
