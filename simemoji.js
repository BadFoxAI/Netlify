import * as config from './config.js';
import * as state from './state.js';
import * as ui from './ui.js';
import { loadGameFromFile, confirmClearSaveData, getEffectiveTileData } from './state.js'; // Import getEffectiveTileData

// --- Game State (Local copies/references for frequent use) ---
let currentGridSize = config.BASE_GRID_SIZE * state.zoomLevel;

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
    state.loadGameFromLocal(); // Load first
    updateCurrentGridSize();    // Update derived values AFTER load
    clampCamera();              // Clamp AFTER load
    ui.selectTile(state.selectedTile); // Update UI AFTER load
    ui.updateSizeUI(); // Update size UI AFTER load
    ui.updateToolUI();
    ui.updateUndoRedoButtons();
    gameLoop();
    console.log("SimEmoji MultiSize Initialized.");
}

function setupCanvas() { /* ... Unchanged ... */
    const canvasContainer = document.getElementById('canvasContainer'); // Get container ref here
    const canvas = document.getElementById('gameCanvas');
    canvas.width = canvasContainer.offsetWidth;
    canvas.height = canvasContainer.offsetHeight;
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

    // Tool Buttons
    ui.buildToolBtn.addEventListener('click', () => ui.setTool('build'));
    ui.bulldozeToolBtn.addEventListener('click', () => ui.setTool('bulldoze'));

    // Size Buttons
    ui.size1xBtn.addEventListener('click', () => ui.selectSize(1));
    ui.size2xBtn.addEventListener('click', () => ui.selectSize(2));
    ui.size3xBtn.addEventListener('click', () => ui.selectSize(3));

    // Save/Load/Clear Buttons
    ui.saveFileBtn.addEventListener('click', state.saveGameToFile);
    ui.loadFileBtn.addEventListener('click', () => ui.fileInput.click());
    ui.fileInput.addEventListener('change', handleFileLoad);
    ui.clearSaveBtn.addEventListener('click', ui.showClearConfirmation);
    ui.clearConfirmYesBtn.addEventListener('click', () => { confirmClearSaveData(); ui.hideClearConfirmation(); });
    ui.clearConfirmNoBtn.addEventListener('click', ui.hideClearConfirmation);

    // Zoom Buttons
    ui.zoomInBtn.addEventListener('click', () => zoom(1 + config.ZOOM_INCREMENT));
    ui.zoomOutBtn.addEventListener('click', () => zoom(1 / (1 + config.ZOOM_INCREMENT)));

    // Undo/Redo Buttons
    ui.undoBtn.addEventListener('click', state.undo);
    ui.redoBtn.addEventListener('click', state.redo);

    // Keyboard Listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });

    // State Loaded Listener
    window.addEventListener('stateLoaded', handleStateLoaded);
}

// --- Event Handlers ---
function handleResize() { /* ... Unchanged ... */
    setupCanvas();
    clampCamera(); // Re-clamp camera on resize
}
function handleMouseMove(e) { /* ... Unchanged ... */
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
        state.setCamPos(panStartCamX - dx, panStartCamY - dy); // Update state directly
        clampCamera();
    }
}

function handleMouseDown(e) {
    const canvas = document.getElementById('gameCanvas');
    // --- Panning ---
    if (e.button === 1 || (e.button === 0 && keys['Space'])) {
        isPanning = true;
        panStartX = mouseScreenX; panStartY = mouseScreenY;
        panStartCamX = state.camX; panStartCamY = state.camY;
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
        return; // Don't process tools if panning
    }

    // --- Tool Interaction ---
    if (e.button === 0) {
        const size = state.selectedSize; // Current size for placement
        const tool = state.currentTool;
        const originX = mouseGridX;
        const originY = mouseGridY;

        // Check bounds for the *entire* object area
        if (originX < 0 || originX + size > config.WORLD_WIDTH_CELLS ||
            originY < 0 || originY + size > config.WORLD_HEIGHT_CELLS) {
            console.log("Placement out of bounds");
            return;
        }

        // --- Bulldoze Logic ---
        if (tool === 'bulldoze') {
            const key = `${originX},${originY}`;
            const targetData = state.gridData.get(key);
            let effectiveOriginX = originX;
            let effectiveOriginY = originY;
            let targetSize = 1;
            let mainTargetData = targetData;

            // If clicked on part of a multi-tile object, find its origin
            if (typeof targetData === 'object' && targetData !== null && !targetData.isOrigin) {
                effectiveOriginX = targetData.originX;
                effectiveOriginY = targetData.originY;
                mainTargetData = state.gridData.get(`${effectiveOriginX},${effectiveOriginY}`);
            }

            // If there's nothing at the effective origin, do nothing
            if (!mainTargetData) return;

            // Determine size of object being bulldozed
            if (typeof mainTargetData === 'object' && mainTargetData !== null && mainTargetData.isOrigin) {
                targetSize = mainTargetData.size;
            } // else it's a single tile (size 1)

            // Prepare action data for undo
            const cellsToClear = [];
            for (let dx = 0; dx < targetSize; dx++) {
                for (let dy = 0; dy < targetSize; dy++) {
                    const currentX = effectiveOriginX + dx;
                    const currentY = effectiveOriginY + dy;
                    const currentKey = `${currentX},${currentY}`;
                    const oldData = state.gridData.get(currentKey) || null;
                    if (oldData !== null) { // Only record if something was actually there
                         cellsToClear.push({ key: currentKey, oldData: oldData, newData: null });
                    }
                }
            }

            if (cellsToClear.length > 0) {
                state.performAction({ type: 'bulldoze', cells: cellsToClear });
            }

        // --- Build Logic ---
        } else if (tool === 'build' && state.selectedTile) {
            // Check if target area is clear for placement
            let canPlace = true;
            const cellsToPlace = [];

            for (let dx = 0; dx < size; dx++) {
                for (let dy = 0; dy < size; dy++) {
                    const currentX = originX + dx;
                    const currentY = originY + dy;
                    const currentKey = `${currentX},${currentY}`;
                    const existingData = state.gridData.get(currentKey);

                    // Check if placement is blocked
                    if (existingData && !config.OVERWRITABLE_TILES.has(existingData)) {
                         // If it's an object, check its origin data type if simple string isn't overwritable
                         let effectiveData = existingData;
                         if(typeof existingData === 'object' && existingData !== null && !existingData.isOrigin) {
                             effectiveData = state.gridData.get(`${existingData.originX},${existingData.originY}`)
                         }
                         // Allow overwriting basic terrain even if it's part of an object theoretically
                         // but better check: is it NOT overwritable? Block if so.
                         if(typeof effectiveData === 'object' || (typeof effectiveData === 'string' && !config.OVERWRITABLE_TILES.has(effectiveData))) {
                             canPlace = false;
                             break; // No need to check further in this row
                         }
                    }
                     // Store intended change for undo/redo
                     cellsToPlace.push({
                         key: currentKey,
                         oldData: existingData || null,
                         newData: (dx === 0 && dy === 0) // Top-left cell
                             ? { tile: state.selectedTile, size: size, isOrigin: true }
                             : { originX: originX, originY: originY, isOrigin: false }
                     });
                }
                if (!canPlace) break; // No need to check further rows
            }

            // If all checks pass, perform the placement action
            if (canPlace) {
                 // Check if the new object is identical to what's already at the origin
                 const originKey = `${originX},${originY}`;
                 const originData = state.gridData.get(originKey);
                 let isIdentical = false;
                 if (typeof originData === 'object' && originData?.isOrigin && originData.tile === state.selectedTile && originData.size === size) {
                     isIdentical = true; // Avoid action if placing the same thing in the same spot
                 } else if (typeof originData === 'string' && originData === state.selectedTile && size === 1) {
                     isIdentical = true; // Avoid placing same 1x1 tile
                 }

                if (!isIdentical) {
                    state.performAction({ type: 'place', cells: cellsToPlace });
                }
            } else {
                console.log("Placement blocked");
                // Optionally provide feedback to the user (e.g., flash red)
            }
        }
    }
}

function handleMouseUp(e) { /* ... Unchanged ... */
    const canvas = document.getElementById('gameCanvas');
    if (e.button === 1 || (e.button === 0 && isPanning)) {
        isPanning = false;
        canvas.style.cursor = 'crosshair';
    }
}
function handleMouseOut() { /* ... Unchanged ... */
    const canvas = document.getElementById('gameCanvas');
    if (isPanning) {
        isPanning = false;
        canvas.style.cursor = 'crosshair';
    }
     mouseGridX = -1; mouseGridY = -1;
     ui.updateCoordsDisplay(-1, -1);
}
function handleMouseWheel(e) { /* ... Unchanged ... */
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? (1 + config.ZOOM_INCREMENT) : (1 / (1 + config.ZOOM_INCREMENT));
    zoom(zoomFactor, mouseScreenX, mouseScreenY);
}
function handleKeyDown(e) { /* ... Unchanged ... */
    keys[e.code] = true;
    if (e.ctrlKey || e.metaKey) {
        if (e.code === 'KeyZ') { e.preventDefault(); state.undo(); }
        else if (e.code === 'KeyY') { e.preventDefault(); state.redo(); }
        else if (e.code === 'KeyS') { e.preventDefault(); state.saveGameToFile(); }
        else if (e.code === 'KeyO') { e.preventDefault(); ui.fileInput.click(); }
    } else {
        if (e.code === 'KeyB') ui.setTool('build');
        if (e.code === 'KeyX') ui.setTool('bulldoze');
        if (e.code === 'Equal' || e.code === 'NumpadAdd') zoom(1 + config.ZOOM_INCREMENT);
        if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoom(1 / (1 + config.ZOOM_INCREMENT));
        // Add keyboard shortcuts for size? (Optional)
        // if (e.code === 'Digit1') ui.selectSize(1);
        // if (e.code === 'Digit2') ui.selectSize(2);
        // if (e.code === 'Digit3') ui.selectSize(3);
    }
}
function handleFileLoad(event) { /* ... Unchanged ... */
    const file = event.target.files[0];
    loadGameFromFile(file); // Call the state function
    event.target.value = null; // Reset input
}
function handleStateLoaded() { /* ... Unchanged ... */
    console.log("Reacting to stateLoaded event");
    updateCurrentGridSize();
    clampCamera();
}

// --- Core Engine Logic ---
function updateCurrentGridSize() { /* ... Unchanged ... */
    currentGridSize = config.BASE_GRID_SIZE * state.zoomLevel;
}
function clampCamera() { /* ... Unchanged ... */
    const canvas = document.getElementById('gameCanvas');
    const worldPixelWidth = config.WORLD_WIDTH_CELLS * config.BASE_GRID_SIZE;
    const worldPixelHeight = config.WORLD_HEIGHT_CELLS * config.BASE_GRID_SIZE;
    const visibleWorldWidth = canvas.width / state.zoomLevel;
    const visibleWorldHeight = canvas.height / state.zoomLevel;

    let newCamX = state.camX; let newCamY = state.camY;
    newCamX = Math.max(0, Math.min(newCamX, worldPixelWidth - visibleWorldWidth));
    newCamY = Math.max(0, Math.min(newCamY, worldPixelHeight - visibleWorldHeight));
    if (worldPixelWidth < visibleWorldWidth) newCamX = (worldPixelWidth - visibleWorldWidth) / 2;
    if (worldPixelHeight < visibleWorldHeight) newCamY = (worldPixelHeight - visibleWorldHeight) / 2;
    state.setCamPos(newCamX, newCamY);
}
function zoom(factor, pivotX, pivotY) { /* ... Unchanged ... */
    const canvas = document.getElementById('gameCanvas');
    pivotX = pivotX ?? canvas.width / 2;
    pivotY = pivotY ?? canvas.height / 2;
    const newZoomLevel = Math.max(config.MIN_ZOOM, Math.min(config.MAX_ZOOM, state.zoomLevel * factor));
    if (newZoomLevel === state.zoomLevel) return;
    const worldPivotX = (pivotX / state.zoomLevel) + state.camX;
    const worldPivotY = (pivotY / state.zoomLevel) + state.camY;
    state.setZoomLevel(newZoomLevel);
    updateCurrentGridSize();
    const newCamX = worldPivotX - (pivotX / newZoomLevel);
    const newCamY = worldPivotY - (pivotY / newZoomLevel);
    state.setCamPos(newCamX, newCamY);
    clampCamera();
}
function updatePanningInput() { /* ... Unchanged (but fixed previously) ... */
    let dx = 0; let dy = 0;
    const panAmount = config.PAN_SPEED_FACTOR * config.BASE_GRID_SIZE;
    if (keys['ArrowLeft'] || keys['KeyA']) dx -= panAmount;
    if (keys['ArrowRight'] || keys['KeyD']) dx += panAmount;
    if (keys['ArrowUp'] || keys['KeyW']) dy -= panAmount;
    if (keys['ArrowDown'] || keys['KeyS']) dy += panAmount;
    if (dx !== 0 || dy !== 0) { state.setCamPos(state.camX + dx, state.camY + dy); clampCamera(); }
}

// --- Rendering ---
function render() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#5a8b5a'; // Background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-state.camX * state.zoomLevel, -state.camY * state.zoomLevel);
    ctx.scale(state.zoomLevel, state.zoomLevel);

    // Visible range calculations... (Unchanged)
    const viewLeftWorld = state.camX;
    const viewTopWorld = state.camY;
    const viewRightWorld = state.camX + canvas.width / state.zoomLevel;
    const viewBottomWorld = state.camY + canvas.height / state.zoomLevel;
    const startGridX = Math.floor(viewLeftWorld / config.BASE_GRID_SIZE) - 1;
    const endGridX = Math.ceil(viewRightWorld / config.BASE_GRID_SIZE) + 1;
    const startGridY = Math.floor(viewTopWorld / config.BASE_GRID_SIZE) - 1;
    const endGridY = Math.ceil(viewBottomWorld / config.BASE_GRID_SIZE) + 1;

    // Draw Grid... (Unchanged)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1 / state.zoomLevel;
    for (let x = startGridX; x <= endGridX; x++) { const wx = x * config.BASE_GRID_SIZE; ctx.beginPath(); ctx.moveTo(wx, startGridY * config.BASE_GRID_SIZE); ctx.lineTo(wx, endGridY * config.BASE_GRID_SIZE); ctx.stroke(); }
    for (let y = startGridY; y <= endGridY; y++) { const wy = y * config.BASE_GRID_SIZE; ctx.beginPath(); ctx.moveTo(startGridX * config.BASE_GRID_SIZE, wy); ctx.lineTo(endGridX * config.BASE_GRID_SIZE, wy); ctx.stroke(); }


    // Draw Placed Tiles (UPDATED for Multi-Tile)
    const baseTileFontSize = config.BASE_GRID_SIZE * 0.8;
    ctx.font = `${baseTileFontSize}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    for (let gx = startGridX; gx < endGridX; gx++) {
        for (let gy = startGridY; gy < endGridY; gy++) {
            if (gx < 0 || gx >= config.WORLD_WIDTH_CELLS || gy < 0 || gy >= config.WORLD_HEIGHT_CELLS) continue;
            const gridKey = `${gx},${gy}`;
            const tileData = state.gridData.get(gridKey);

            // Only draw if it's a simple tile string OR the origin of a multi-tile object
            if (typeof tileData === 'string') {
                // Draw simple string tile
                ctx.fillText(tileData, gx * config.BASE_GRID_SIZE + config.BASE_GRID_SIZE / 2, gy * config.BASE_GRID_SIZE + config.BASE_GRID_SIZE / 2);
            } else if (typeof tileData === 'object' && tileData !== null && tileData.isOrigin) {
                // Draw the origin tile of a multi-tile object
                // For now, draw it centered in its top-left cell.
                // Could optionally draw larger or centered over its full area later.
                 ctx.fillText(tileData.tile, gx * config.BASE_GRID_SIZE + config.BASE_GRID_SIZE / 2, gy * config.BASE_GRID_SIZE + config.BASE_GRID_SIZE / 2);
                 // --- Optional: Draw border around multi-tile object ---
                 // ctx.strokeStyle = 'rgba(0,0,255,0.3)'; // Example blue border
                 // ctx.lineWidth = 1 / state.zoomLevel;
                 // ctx.strokeRect(gx * config.BASE_GRID_SIZE, gy * config.BASE_GRID_SIZE, config.BASE_GRID_SIZE * tileData.size, config.BASE_GRID_SIZE * tileData.size);
                 // ------------------------------------------------------
            }
            // Implicitly skip drawing if it's part of a multi-tile object but not the origin
        }
    }

    // Draw Mouse Hover / Tool Preview (UPDATED for Multi-Tile & Validity)
    if (mouseGridX >= 0 && mouseGridY >= 0 && // Basic bounds check
        mouseScreenX >= 0 && mouseScreenY >= 0 && mouseScreenX <= canvas.width && mouseScreenY <= canvas.height)
    {
        const hoverSize = state.currentTool === 'build' ? state.selectedSize : 1; // Bulldoze always targets 1x1 initially
        const hoverEndX = mouseGridX + hoverSize;
        const hoverEndY = mouseGridY + hoverSize;

        // Check if hover area is within world bounds
        if (hoverEndX <= config.WORLD_WIDTH_CELLS && hoverEndY <= config.WORLD_HEIGHT_CELLS) {
            const hoverWorldX = mouseGridX * config.BASE_GRID_SIZE;
            const hoverWorldY = mouseGridY * config.BASE_GRID_SIZE;
            const previewWorldWidth = config.BASE_GRID_SIZE * hoverSize;
            const previewWorldHeight = config.BASE_GRID_SIZE * hoverSize;
            ctx.lineWidth = 2 / state.zoomLevel;

            if (state.currentTool === 'build' && state.selectedTile) {
                // Check placement validity
                let canPlacePreview = true;
                for (let dx = 0; dx < hoverSize; dx++) {
                    for (let dy = 0; dy < hoverSize; dy++) {
                        const checkX = mouseGridX + dx;
                        const checkY = mouseGridY + dy;
                        const existingData = state.gridData.get(`${checkX},${checkY}`);
                        if (existingData && !config.OVERWRITABLE_TILES.has(existingData)) {
                             let effectiveData = existingData;
                             if(typeof existingData === 'object' && existingData !== null && !existingData.isOrigin) {
                                 effectiveData = state.gridData.get(`${existingData.originX},${existingData.originY}`)
                             }
                             if(typeof effectiveData === 'object' || (typeof effectiveData === 'string' && !config.OVERWRITABLE_TILES.has(effectiveData))) {
                                 canPlacePreview = false;
                                 break;
                             }
                        }
                    }
                    if (!canPlacePreview) break;
                }

                // Draw semi-transparent tile centered in the potential area
                ctx.globalAlpha = 0.5;
                // Adjust font size slightly for preview if multi-tile? Optional.
                // const previewFontSize = config.BASE_GRID_SIZE * 0.8 * (hoverSize > 1 ? 0.8 : 1.0);
                // ctx.font = `${previewFontSize}px sans-serif`;
                ctx.fillText(state.selectedTile, hoverWorldX + previewWorldWidth / 2, hoverWorldY + previewWorldHeight / 2);
                ctx.globalAlpha = 1.0;
                ctx.font = `${baseTileFontSize}px sans-serif`; // Reset font

                // Draw border: Green if valid, Red if invalid
                ctx.strokeStyle = canPlacePreview ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)';
                ctx.strokeRect(hoverWorldX + ctx.lineWidth/2, hoverWorldY + ctx.lineWidth/2, previewWorldWidth - ctx.lineWidth, previewWorldHeight - ctx.lineWidth);

            } else if (state.currentTool === 'bulldoze') {
                // Highlight the single cell OR the entire object if hovering over part of one
                let effectiveOriginX = mouseGridX;
                let effectiveOriginY = mouseGridY;
                let targetSize = 1;
                const targetData = state.gridData.get(`${mouseGridX},${mouseGridY}`);
                 if (typeof targetData === 'object' && targetData !== null && !targetData.isOrigin) {
                    effectiveOriginX = targetData.originX;
                    effectiveOriginY = targetData.originY;
                    const mainTargetData = state.gridData.get(`${effectiveOriginX},${effectiveOriginY}`);
                    if(typeof mainTargetData === 'object' && mainTargetData !== null && mainTargetData.isOrigin) {
                        targetSize = mainTargetData.size;
                    }
                 } else if (typeof targetData === 'object' && targetData !== null && targetData.isOrigin) {
                     targetSize = targetData.size;
                 }

                const effectiveHoverX = effectiveOriginX * config.BASE_GRID_SIZE;
                const effectiveHoverY = effectiveOriginY * config.BASE_GRID_SIZE;
                const effectivePreviewSize = config.BASE_GRID_SIZE * targetSize;

                ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)'; // Red for bulldoze
                ctx.strokeRect(effectiveHoverX + ctx.lineWidth/2, effectiveHoverY + ctx.lineWidth/2, effectivePreviewSize - ctx.lineWidth, effectivePreviewSize - ctx.lineWidth);
            }
        }
    }


    ctx.restore(); // Restore canvas state
}


// --- Game Loop ---
function gameLoop() { /* ... Unchanged ... */
    updatePanningInput();
    render();
    requestAnimationFrame(gameLoop);
}

// --- Start ---
init();
