import * as config from './config.js';
import * as state from './state.js';
import * as ui from './ui.js';
// Use the corrected helper function name
import { loadGameFromFile, confirmClearSaveData, getEffectiveTileInfo } from './state.js';
import { drawGeneratedTile } from './drawingUtils.js';

// --- Game State ---
let currentGridSize = config.BASE_GRID_SIZE * state.zoomLevel;
let isLayerIsolationActive = false;
// isolatedLayer state removed - derive from state.currentPlacementLayer when needed

// --- Mouse State ---
let mouseScreenX = 0, mouseScreenY = 0; let mouseWorldX = 0, mouseWorldY = 0; let mouseGridX = 0, mouseGridY = 0;
let keys = {}; let isPanning = false; let panStartX = 0, panStartY = 0; let panStartCamX = 0, panStartCamY = 0;

// --- Initialization ---
function init() {
    ui.populatePalette();
    setupCanvas();
    addEventListeners();
    state.loadGameFromLocal(); // Load state first
    // Update engine/UI based on loaded/default state
    updateCurrentGridSize();
    clampCamera();
    ui.selectTile(state.selectedTile); // Sets tile and currentPlacementLayer, updates display
    ui.updateSizeUI();
    // ui.updateLayerUI(); // Removed
    ui.updateToolUI();
    ui.updateUndoRedoButtons();
    updateIsolationDisplay(); // Update isolation visual based on initial state
    gameLoop();
    console.log("SimEmoji v9 Initialized."); // Update version log
}

function setupCanvas() {
    const canvasContainer = document.getElementById('canvasContainer');
    const canvas = document.getElementById('gameCanvas');
    canvas.width = canvasContainer.offsetWidth;
    canvas.height = canvasContainer.offsetHeight;
    // const ctx = canvas.getContext('2d');
    // ctx.imageSmoothingEnabled = false; // Keep pixelated look?
}

// --- Event Handling Setup ---
function addEventListeners() {
    const canvas = document.getElementById('gameCanvas');
    window.addEventListener('resize', handleResize);
    canvas.addEventListener('mousemove', handleMouseMove); canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp); canvas.addEventListener('mouseout', handleMouseOut);
    canvas.addEventListener('wheel', handleMouseWheel, { passive: false });

    // Tools, Size, Save/Load/Clear, Zoom, Undo/Redo listeners...
    ui.buildToolBtn.addEventListener('click', () => ui.setTool('build')); ui.bulldozeToolBtn.addEventListener('click', () => ui.setTool('bulldoze'));
    ui.sizeSlider.addEventListener('input', () => ui.selectSize(parseInt(ui.sizeSlider.value, 10)));
    ui.saveFileBtn.addEventListener('click', state.saveGameToFile); ui.loadFileBtn.addEventListener('click', () => ui.fileInput.click());
    ui.fileInput.addEventListener('change', handleFileLoad); ui.clearSaveBtn.addEventListener('click', ui.showClearConfirmation);
    ui.clearConfirmYesBtn.addEventListener('click', () => { confirmClearSaveData(); ui.hideClearConfirmation(); }); // confirmClearSaveData resets state
    ui.clearConfirmNoBtn.addEventListener('click', ui.hideClearConfirmation);
    ui.zoomInBtn.addEventListener('click', () => zoom(1 + config.ZOOM_INCREMENT)); ui.zoomOutBtn.addEventListener('click', () => zoom(1 / (1 + config.ZOOM_INCREMENT)));
    ui.undoBtn.addEventListener('click', state.undo); ui.redoBtn.addEventListener('click', state.redo);

    // Isolation Button Listener
    const isolateBtn = document.getElementById('isolateLayerBtn');
    if(isolateBtn) { isolateBtn.addEventListener('click', toggleLayerIsolation); } else { console.error("Isolate Layer button not found!"); }

    // Keyboard Listeners...
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    // State Loaded Listener...
    window.addEventListener('stateLoaded', handleStateLoaded);
}

// --- Layer Change Helper --- REMOVED

// --- Layer Isolation ---
function toggleLayerIsolation() {
    isLayerIsolationActive = !isLayerIsolationActive;
    updateIsolationDisplay();
    const displayLayer = isLayerIsolationActive ? state.currentPlacementLayer : 'All';
    console.log(`Layer Isolation ${isLayerIsolationActive ? 'ON' : 'OFF'} (Target Layer: ${displayLayer})`);
}

function updateIsolationDisplay() {
    const isolateBtn = document.getElementById('isolateLayerBtn');
    const layerInfoSpan = document.getElementById('currentLayerInfo'); // Get the info span

    if (isolateBtn) {
        isolateBtn.classList.toggle('isolation-active', isLayerIsolationActive);
        isolateBtn.title = isLayerIsolationActive
            ? `Isolating Layer ${state.currentPlacementLayer} (Click to Show All)`
            : 'Toggle Layer Isolation (L)';
    }
    if (layerInfoSpan) {
        // Always show the layer the current tile WILL be placed on
        layerInfoSpan.textContent = `Layer: ${state.currentPlacementLayer}`;
         if (isLayerIsolationActive) {
             layerInfoSpan.title = `Isolation ON (Showing Layer ${state.currentPlacementLayer})`;
             layerInfoSpan.style.fontWeight = 'bold';
             layerInfoSpan.style.color = 'yellow';
         } else {
             layerInfoSpan.title = `Placing on Layer ${state.currentPlacementLayer}`;
             layerInfoSpan.style.fontWeight = 'normal';
             layerInfoSpan.style.color = '#ccc';
         }
    }
     // Update panel border indicator
     const uiPanel = document.getElementById('uiPanel');
     if(uiPanel) { uiPanel.style.borderLeft = isLayerIsolationActive ? '3px solid yellow' : 'none'; }
}


// --- Event Handlers ---
function handleResize() { setupCanvas(); clampCamera(); }
function handleMouseMove(e) { const canvas=document.getElementById('gameCanvas'); const rect=canvas.getBoundingClientRect(); mouseScreenX=e.clientX-rect.left; mouseScreenY=e.clientY-rect.top; mouseWorldX=(mouseScreenX/state.zoomLevel)+state.camX; mouseWorldY=(mouseScreenY/state.zoomLevel)+state.camY; mouseGridX=Math.floor(mouseWorldX/config.BASE_GRID_SIZE); mouseGridY=Math.floor(mouseWorldY/config.BASE_GRID_SIZE); ui.updateCoordsDisplay(mouseGridX,mouseGridY); if(isPanning){ const dx=(mouseScreenX-panStartX)/state.zoomLevel; const dy=(mouseScreenY-panStartY)/state.zoomLevel; state.setCamPos(panStartCamX-dx,panStartCamY-dy); clampCamera(); } }

function handleMouseDown(e) {
    const canvas = document.getElementById('gameCanvas');
    // Panning
    if (e.button === 1 || (e.button === 0 && keys['Space'])) { isPanning=true; panStartX=mouseScreenX; panStartY=mouseScreenY; panStartCamX=state.camX; panStartCamY=state.camY; canvas.style.cursor='grabbing'; e.preventDefault(); return; }

    // Tool Interaction
    if (e.button === 0) {
        const size = state.selectedSize; const tool = state.currentTool;
        const layerToPlaceOn = state.currentPlacementLayer; // Derived from selected tile
        const originX = mouseGridX; const originY = mouseGridY;
        if (originX < 0 || originX + size > config.WORLD_WIDTH_CELLS || originY < 0 || originY + size > config.WORLD_HEIGHT_CELLS) return;

        const tileToPlace = state.selectedTile;
        const isGroundTile = config.GROUND_TILES.has(tileToPlace);
        const isPathTile = config.PATH_TILES.has(tileToPlace);

        // --- Layer Placement Rule Check ---
        if (tool === 'build') { if (isGroundTile&&layerToPlaceOn!==config.LAYER_GROUND){ui.showStatusMessage("Ground tiles only on Layer 0!",false);return;} if (!isGroundTile&&layerToPlaceOn===config.LAYER_GROUND){ui.showStatusMessage("Cannot place non-ground on Layer 0!",false);return;} if (isPathTile&&layerToPlaceOn!==config.LAYER_PATHS){ui.showStatusMessage("Path tiles only on Layer 1!",false);return;} }

        // Bulldoze Logic (Uses getEffectiveTileInfo)
        if (tool === 'bulldoze') {
            const objectToDelete = getEffectiveTileInfo(originX, originY); // Find topmost at click point
            // Check isolation: only delete if found AND (isolation is off OR object is on isolated layer)
            // *** Corrected isolation layer check: compare with the derived placement layer of the selected tile ***
            if (!objectToDelete || (isLayerIsolationActive && objectToDelete.layer !== state.currentPlacementLayer)) {
                console.log("Nothing to bulldoze on visible/target layer."); return;
            }

            const cellsToClear = []; const objectLayer = objectToDelete.layer;
            for (let dx=0; dx<objectToDelete.size; dx++) { for (let dy=0; dy<objectToDelete.size; dy++) {
                const cX=objectToDelete.originX+dx; const cY=objectToDelete.originY+dy; const cK=`${cX},${cY}`;
                const currentLayerMap = state.gridData.get(cK);
                if (!currentLayerMap || !currentLayerMap[objectLayer]) continue;

                const newLayerMap = { ...currentLayerMap }; delete newLayerMap[objectLayer];
                cellsToClear.push({ key: cK, oldLayerMap: currentLayerMap, newLayerMap: Object.keys(newLayerMap).length === 0 ? null : newLayerMap });
            }}
            if (cellsToClear.length > 0) { state.performAction({ type: 'bulldoze', cells: cellsToClear }); }

        // Build Logic (Uses getEffectiveTileInfo)
        } else if (tool === 'build' && tileToPlace) {
            let canPlace = true; const cellsToModify = [];
            for (let dx=0; dx<size; dx++) { for (let dy=0; dy<size; dy++) {
                const cX=originX+dx; const cY=originY+dy; const cK=`${cX},${cY}`;
                const existingInfo = getEffectiveTileInfo(cX, cY); // Check topmost existing tile/object

                // --- Collision Check ---
                if (existingInfo && layerToPlaceOn <= existingInfo.layer) {
                    if (!((layerToPlaceOn===config.LAYER_GROUND&&existingInfo.layer===config.LAYER_GROUND&&isGroundTile) || (layerToPlaceOn===config.LAYER_PATHS&&existingInfo.layer===config.LAYER_PATHS&&isPathTile))) { canPlace=false; console.log(`Placement blocked at ${cX},${cY} by existing layer ${existingInfo.layer}`); break; }
                } // --- End Collision Check ---

                const currentLayerMap = state.gridData.get(cK);
                const newDataForLayer = (dx===0&&dy===0) ? {tile:tileToPlace,size:size,isOrigin:true} : {originX:originX,originY:originY,isOrigin:false};
                const newLayerMap = { ...(currentLayerMap || {}) }; newLayerMap[layerToPlaceOn] = newDataForLayer;
                cellsToModify.push({ key: cK, oldLayerMap: currentLayerMap || null, newLayerMap: newLayerMap });
            } if (!canPlace) break; }

            if (canPlace) {
                 const originInfo=getEffectiveTileInfo(originX,originY); let isIdentical=false;
                 // Check if topmost item at origin is the same tile, size, and layer
                 if(originInfo&&originInfo.isOrigin&&originInfo.tile===tileToPlace&&originInfo.size===size&&originInfo.layer===layerToPlaceOn){isIdentical=true;}
                 if(!isIdentical){state.performAction({type:'place',cells:cellsToModify});} else {console.log("Identical placement skipped.");}
            } else { ui.showStatusMessage("Placement blocked", false); }
        }
    }
}
function handleMouseUp(e) { if (e.button === 1 || (e.button === 0 && isPanning)) { isPanning = false; document.getElementById('gameCanvas').style.cursor = 'crosshair'; } }
function handleMouseOut() { if (isPanning) { isPanning = false; document.getElementById('gameCanvas').style.cursor = 'crosshair'; } mouseGridX = -1; mouseGridY = -1; ui.updateCoordsDisplay(-1, -1); }
function handleMouseWheel(e) { e.preventDefault(); const z = e.deltaY < 0 ? (1 + config.ZOOM_INCREMENT) : (1 / (1 + config.ZOOM_INCREMENT)); zoom(z, mouseScreenX, mouseScreenY); }
function handleKeyDown(e) {
    keys[e.code]=true;
    if(e.ctrlKey||e.metaKey){ if(e.code==='KeyZ'){e.preventDefault();state.undo();}else if(e.code==='KeyY'){e.preventDefault();state.redo();}else if(e.code==='KeyS'){e.preventDefault();state.saveGameToFile();}else if(e.code==='KeyO'){e.preventDefault();ui.fileInput.click();}}
    else { if(e.code==='KeyB')ui.setTool('build'); if(e.code==='KeyX')ui.setTool('bulldoze'); if(e.code==='Equal'||e.code==='NumpadAdd'){e.preventDefault();zoom(1+config.ZOOM_INCREMENT);} if(e.code==='Minus'||e.code==='NumpadSubtract'){e.preventDefault();zoom(1/(1+config.ZOOM_INCREMENT));} if(e.code === 'KeyL') toggleLayerIsolation();}
}
function handleFileLoad(event) { const file = event.target.files[0]; loadGameFromFile(file); event.target.value = null; }
function handleStateLoaded() { // Ensure isolation display updates on load/clear
    console.log("Reacting to stateLoaded event"); updateCurrentGridSize(); clampCamera(); ui.updateSizeUI(); /*ui.updateLayerUI removed*/ updateIsolationDisplay();
}

// --- Core Engine Logic ---
function updateCurrentGridSize(){currentGridSize=config.BASE_GRID_SIZE*state.zoomLevel;}
function clampCamera(){const c=document.getElementById('gameCanvas'); const wpw=config.WORLD_WIDTH_CELLS*config.BASE_GRID_SIZE; const wph=config.WORLD_HEIGHT_CELLS*config.BASE_GRID_SIZE; const vww=c.width/state.zoomLevel; const vwh=c.height/state.zoomLevel; let nX=state.camX; let nY=state.camY; nX=Math.max(0,Math.min(nX,wpw-vww)); nY=Math.max(0,Math.min(nY,wph-vwh)); if(wpw<vww) nX=(wpw-vww)/2; if(wph<vwh) nY=(wph-vwh)/2; state.setCamPos(nX, nY);}
function zoom(factor, pivotX, pivotY) {
    const canvas = document.getElementById('gameCanvas'); pivotX = pivotX ?? canvas.width / 2; pivotY = pivotY ?? canvas.height / 2; const currentZoom = Number(state.zoomLevel) || 1.0;
    const newZoomLevel = Math.max(config.MIN_ZOOM, Math.min(config.MAX_ZOOM, currentZoom * factor)); if (newZoomLevel === currentZoom) return; const worldPivotX = (pivotX / currentZoom) + state.camX; const worldPivotY = (pivotY / currentZoom) + state.camY; state.setZoomLevel(newZoomLevel); updateCurrentGridSize(); const newCamX = worldPivotX - (pivotX / newZoomLevel); const newCamY = worldPivotY - (pivotY / newZoomLevel); state.setCamPos(newCamX, newCamY); clampCamera();
}
function updatePanningInput(){let dx=0; let dy=0; const pA=config.PAN_SPEED_FACTOR*config.BASE_GRID_SIZE; if(keys['ArrowLeft']||keys['KeyA'])dx-=pA; if(keys['ArrowRight']||keys['KeyD'])dx+=pA; if(keys['ArrowUp']||keys['KeyW'])dy-=pA; if(keys['ArrowDown']||keys['KeyS'])dy+=pA; if(dx!==0||dy!==0){state.setCamPos(state.camX+dx,state.camY+dy); clampCamera();}}

// --- Rendering ---
function render() {
    const canvas=document.getElementById('gameCanvas'); const ctx=canvas.getContext('2d'); ctx.fillStyle='#5a8b5a'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.save();
    ctx.translate(-state.camX*state.zoomLevel,-state.camY*state.zoomLevel); ctx.scale(state.zoomLevel,state.zoomLevel);
    const viewLeftWorld=state.camX; const viewTopWorld=state.camY; const viewRightWorld=state.camX+canvas.width/state.zoomLevel; const viewBottomWorld=state.camY+canvas.height/state.zoomLevel; const startGridX=Math.floor(viewLeftWorld/config.BASE_GRID_SIZE)-1; const endGridX=Math.ceil(viewRightWorld/config.BASE_GRID_SIZE)+1; const startGridY=Math.floor(viewTopWorld/config.BASE_GRID_SIZE)-1; const endGridY=Math.ceil(viewBottomWorld/config.BASE_GRID_SIZE)+1;
    ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=1/state.zoomLevel; for(let x=startGridX;x<=endGridX;x++){const wx=x*config.BASE_GRID_SIZE; ctx.beginPath();ctx.moveTo(wx,startGridY*config.BASE_GRID_SIZE);ctx.lineTo(wx,endGridY*config.BASE_GRID_SIZE);ctx.stroke();} for(let y=startGridY;y<=endGridY;y++){const wy=y*config.BASE_GRID_SIZE; ctx.beginPath();ctx.moveTo(startGridX*config.BASE_GRID_SIZE,wy);ctx.lineTo(endGridX*config.BASE_GRID_SIZE,wy);ctx.stroke();}

    // Prepare Render List (Includes Layer Isolation Check)
    const renderList=[]; const baseTileFontSize=config.BASE_GRID_SIZE*0.8; ctx.textAlign='center'; ctx.textBaseline='middle'; const drawnOrigins=new Set();
    for(let gx=startGridX;gx<endGridX;gx++){for(let gy=startGridY;gy<endGridY;gy++){ if(gx<0||gx>=config.WORLD_WIDTH_CELLS||gy<0||gy>=config.WORLD_HEIGHT_CELLS)continue; const key=`${gx},${gy}`; const layerMap=state.gridData.get(key); if(!layerMap)continue; const layers=Object.keys(layerMap).map(Number).sort((a,b)=>a-b);
        for(const layer of layers){
            // *** ISOLATION FILTER ***
            if (isLayerIsolationActive && layer !== state.currentPlacementLayer) continue;

            const tileData=layerMap[layer]; let tileIdToRender=null; let itemSize=1; let isOrigin=false; let originX=gx; let originY=gy; let worldX=0,worldY=0,worldYBottom=0; let itemFontSize=baseTileFontSize; let isGenerated=false;
            if(typeof tileData==='string'){tileIdToRender=tileData;itemSize=1;isOrigin=true;originX=gx;originY=gy;}else if(typeof tileData==='object'&&tileData!==null){if(tileData.isOrigin){tileIdToRender=tileData.tile;itemSize=tileData.size||1;isOrigin=true;originX=gx;originY=gy;}else{const oK=`${tileData.originX},${tileData.originY}`;const oLM=state.gridData.get(oK);const oD=oLM?oLM[layer]:null;if(oD?.isOrigin){tileIdToRender=oD.tile;itemSize=oD.size||1;isOrigin=false;originX=tileData.originX;originY=tileData.originY;}else{continue;}}}
            if(tileIdToRender!==null){isGenerated=config.GENERATED_TILE_IDS.has(tileIdToRender);itemFontSize=baseTileFontSize*(itemSize*0.8);const oWW=config.BASE_GRID_SIZE*itemSize;const oWH=config.BASE_GRID_SIZE*itemSize;worldX=originX*config.BASE_GRID_SIZE+oWW/2;worldY=originY*config.BASE_GRID_SIZE+oWH/2;worldYBottom=(originY+itemSize)*config.BASE_GRID_SIZE;const originId=`${originX},${originY},${layer}`; if(isOrigin&&!drawnOrigins.has(originId)){renderList.push({tile:tileIdToRender,x:worldX,y:worldY,size:itemSize,layer:layer,fontSize:itemFontSize,worldYBottom:worldYBottom,isGenerated:isGenerated}); drawnOrigins.add(originId);}}
        }}}
    // Sort & Draw (Unchanged)
    renderList.sort((a,b)=>{if(a.layer!==b.layer)return a.layer-b.layer; return a.worldYBottom-b.worldYBottom;});
    renderList.forEach(item=>{if(item.isGenerated){const dX=item.x-(config.BASE_GRID_SIZE*item.size)/2; const dY=item.y-(config.BASE_GRID_SIZE*item.size)/2; drawGeneratedTile(ctx,dX,dY,config.BASE_GRID_SIZE*item.size,item.tile);}else{ctx.font=`${item.fontSize}px sans-serif`; ctx.fillText(item.tile,item.x,item.y);}});
    ctx.font=`${baseTileFontSize}px sans-serif`;

    // Draw Preview (Unchanged)
     if (mouseGridX >= 0 && mouseGridY >= 0 && mouseScreenX >= 0 && mouseScreenY >= 0 && mouseScreenX <= canvas.width && mouseScreenY <= canvas.height){const hoverSize=state.currentTool==='build'?state.selectedSize:1; const hEndX=mouseGridX+hoverSize; const hEndY=mouseGridY+hoverSize; if(hEndX<=config.WORLD_WIDTH_CELLS&&hEndY<=config.WORLD_HEIGHT_CELLS){ const hWX=mouseGridX*config.BASE_GRID_SIZE; const hWY=mouseGridY*config.BASE_GRID_SIZE; const pWW=config.BASE_GRID_SIZE*hoverSize; const pWH=config.BASE_GRID_SIZE*hoverSize; ctx.lineWidth=2/state.zoomLevel;
        if(state.currentTool==='build'&&state.selectedTile){ let canPlacePreview=true; const pLayer=state.currentPlacementLayer; const isPGround=config.GROUND_TILES.has(state.selectedTile); const isPPath=config.PATH_TILES.has(state.selectedTile); if(pLayer===config.LAYER_GROUND&&!isPGround)canPlacePreview=false; if(pLayer>config.LAYER_GROUND&&isPGround)canPlacePreview=false; if(isPPath&&pLayer!==config.LAYER_PATHS)canPlacePreview=false; if(canPlacePreview){for(let dx=0;dx<hoverSize;dx++){for(let dy=0;dy<hoverSize;dy++){const cX=mouseGridX+dx;const cY=mouseGridY+dy;const eInfo=getEffectiveTileInfo(cX,cY); if(eInfo&&pLayer<=eInfo.layer){if(!((pLayer===config.LAYER_PATHS&&eInfo.layer===config.LAYER_GROUND)||(pLayer===config.LAYER_FEATURES&&eInfo.layer<=config.LAYER_PATHS)||(pLayer===config.LAYER_BUILDINGS&&eInfo.layer<=config.LAYER_FEATURES)||(pLayer===config.LAYER_AIR&&eInfo.layer<=config.LAYER_BUILDINGS))){canPlacePreview=false;break;}}}if(!canPlacePreview)break;}}
            ctx.globalAlpha=0.5; const pFS=baseTileFontSize*(hoverSize*0.8); ctx.font=`${pFS}px sans-serif`; if(config.GENERATED_TILE_IDS.has(state.selectedTile)){const pDX=hWX;const pDY=hWY;drawGeneratedTile(ctx,pDX,pDY,pWW,state.selectedTile);}else{ctx.fillText(state.selectedTile,hWX+pWW/2,hWY+pWH/2);} ctx.globalAlpha=1.0; ctx.font=`${baseTileFontSize}px sans-serif`; ctx.strokeStyle=canPlacePreview?'rgba(0,255,0,0.8)':'rgba(255,0,0,0.8)'; ctx.strokeRect(hWX+ctx.lineWidth/2,hWY+ctx.lineWidth/2,pWW-ctx.lineWidth,pWH-ctx.lineWidth);
        }else if(state.currentTool==='bulldoze'){ let eX=mouseGridX;let eY=mouseGridY;let tS=1;const tInfo=getEffectiveTileInfo(eX,eY);if(tInfo){eX=tInfo.originX;eY=tInfo.originY;tS=tInfo.size;} const eHX=eX*config.BASE_GRID_SIZE;const eHY=eY*config.BASE_GRID_SIZE;const eP=config.BASE_GRID_SIZE*tS;ctx.strokeStyle='rgba(255,0,0,0.8)';ctx.strokeRect(eHX+ctx.lineWidth/2,eHY+ctx.lineWidth/2,eP-ctx.lineWidth,eP-ctx.lineWidth);}
    }}
    ctx.restore();
}

// --- Game Loop ---
function gameLoop(){ updatePanningInput(); render(); requestAnimationFrame(gameLoop); }
// --- Start ---
init();
