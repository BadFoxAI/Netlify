import * as config from './config.js';
import * as state from './state.js';
import * as ui from './ui.js';
import { loadGameFromFile, confirmClearSaveData } from './state.js'; // Import specific state functions needed for listeners

// --- Game State (Local copies/references for frequent use) ---
let currentGridSize = config.BASE_GRID_SIZE * state.zoomLevel; // Calculate initial

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
    ui.populatePalette(); // Was missing in v3 implementation detail, now explicitly called
    setupCanvas();
    addEventListeners();
    state.loadGameFromLocal(); // Try loading saved data
    // State loaded might have changed zoom/camera, update derived values
    updateCurrentGridSize();
    clampCamera();
    // Ensure UI reflects loaded state
    ui.selectTile(state.selectedTile);
    ui.updateToolUI();
    ui.updateUndoRedoButtons();
    gameLoop();
    console.log("SimEmoji Refactored Initialized.");
}

function setupCanvas() {
    const canvasContainer = document.getElementById('canvasContainer'); // Get container ref here
    const canvas = document.getElementById('gameCanvas');
    canvas.width = canvasContainer.offsetWidth;
    canvas.height = canvasContainer.offsetHeight;
    // ctx.imageSmoothingEnabled = false; // Optional based on preference
}

// --- Event Handling Setup ---
function addEventListeners() {
    const canvas = document.getElementById('gameCanvas'); // Get canvas ref here
    window.addEventListener('resize', handleResize);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseout', handleMouseOut);
    canvas.addEventListener('wheel', handleMouseWheel, { passive: false });

    ui.buildToolBtn.addEventListener('click', () => ui.setTool('build'));
    ui.bulldozeToolBtn.addEventListener('click', () => ui.setTool('bulldoze'));
    ui.saveFileBtn.addEventListener('click', state.saveGameToFile);
    ui.loadFileBtn.addEventListener('click', () => ui.fileInput.click());
    ui.fileInput.addEventListener('change', handleFileLoad); // Use wrapper
    ui.clearSaveBtn.addEventListener('click', ui.showClearConfirmation);
    ui.clearConfirmYesBtn.addEventListener('click', () => {
        confirmClearSaveData(); // Call state function
        ui.hideClearConfirmation(); // Hide UI
    });
    ui.clearConfirmNoBtn.addEventListener('click', ui.hideClearConfirmation);

    ui.zoomInBtn.addEventListener('click', () => zoom(1 + config.ZOOM_INCREMENT));
    ui.zoomOutBtn.addEventListener('click', () => zoom(1 / (1 + config.ZOOM_INCREMENT)));
    ui.undoBtn.addEventListener('click', state.undo);
    ui.redoBtn.addEventListener('click', state.redo);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });

    // Listen for custom event from state.js after file load
    window.addEventListener('stateLoaded', handleStateLoaded);
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
        state.setCamPos(panStartCamX - dx, panStartCamY - dy); // Update state directly
        clampCamera();
    }
}

function handleMouseDown(e) {
    const canvas = document.getElementById('gameCanvas');
    // Middle mouse or Left click + Space for panning
    if (e.button === 1 || (e.button === 0 && keys['Space'])) {
        isPanning = true;
        panStartX = mouseScreenX; panStartY = mouseScreenY;
        panStartCamX = state.camX; panStartCamY = state.camY; // Use current state
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
    }
    // Left click for tools
    else if (e.button === 0) {
        if (mouseGridX < 0 || mouseGridX >= config.WORLD_WIDTH_CELLS || mouseGridY < 0 || mouseGridY >= config.WORLD_HEIGHT_CELLS) return;

        const gridKey = `${mouseGridX},${mouseGridY}`;
        const oldTile = state.gridData.get(gridKey) || null;

        if (state.currentTool === 'build' && state.selectedTile && oldTile !== state.selectedTile) {
            state.performAction('place', gridKey, oldTile, state.selectedTile);
        } else if (state.currentTool === 'bulldoze' && oldTile !== null) {
            state.performAction('bulldoze', gridKey, oldTile, null);
        }
    }
}

function handleMouseUp(e) {
    const canvas = document.getElementById('gameCanvas');
    if (e.button === 1 || (e.button === 0 && isPanning)) {
        isPanning = false;
        canvas.style.cursor = 'crosshair';
    }
}

function handleMouseOut() {
    const canvas = document.getElementById('gameCanvas');
    if (isPanning) {
        isPanning = false;
        canvas.style.cursor = 'crosshair';
    }
     mouseGridX = -1; mouseGridY = -1;
     ui.updateCoordsDisplay(-1, -1);
}

function handleMouseWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? (1 + config.ZOOM_INCREMENT) : (1 / (1 + config.ZOOM_INCREMENT));
    zoom(zoomFactor, mouseScreenX, mouseScreenY);
}

function handleKeyDown(e) {
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
    }
}

function handleFileLoad(event) {
    const file = event.target.files[0];
    loadGameFromFile(file); // Call the state function
    event.target.value = null; // Reset input
}

function handleStateLoaded() {
    // Called via custom event when state.js finishes loading a file
    console.log("Reacting to stateLoaded event");
    updateCurrentGridSize();
    clampCamera();
    // UI should already be updated by loadGameFromFile calling selectTile etc.
}


// --- Core Engine Logic ---
function updateCurrentGridSize() {
    currentGridSize = config.BASE_GRID_SIZE * state.zoomLevel;
}

function clampCamera() {
    const canvas = document.getElementById('gameCanvas');
    const worldPixelWidth = config.WORLD_WIDTH_CELLS * config.BASE_GRID_SIZE;
    const worldPixelHeight = config.WORLD_HEIGHT_CELLS * config.BASE_GRID_SIZE;
    const visibleWorldWidth = canvas.width / state.zoomLevel;
    const visibleWorldHeight = canvas.height / state.zoomLevel;

    let newCamX = state.camX;
    let newCamY = state.camY;

    newCamX = Math.max(0, Math.min(newCamX, worldPixelWidth - visibleWorldWidth));
    newCamY = Math.max(0, Math.min(newCamY, worldPixelHeight - visibleWorldHeight));

    if (worldPixelWidth < visibleWorldWidth) newCamX = (worldPixelWidth - visibleWorldWidth) / 2;
    if (worldPixelHeight < visibleWorldHeight) newCamY = (worldPixelHeight - visibleWorldHeight) / 2;

    state.setCamPos(newCamX, newCamY); // Update state
}

function zoom(factor, pivotX, pivotY) {
    const canvas = document.getElementById('gameCanvas');
    pivotX = pivotX ?? canvas.width / 2; // Default pivot to center
    pivotY = pivotY ?? canvas.height / 2;

    const newZoomLevel = Math.max(config.MIN_ZOOM, Math.min(config.MAX_ZOOM, state.zoomLevel * factor));
    if (newZoomLevel === state.zoomLevel) return;

    const worldPivotX = (pivotX / state.zoomLevel) + state.camX;
    const worldPivotY = (pivotY / state.zoomLevel) + state.camY;

    state.setZoomLevel(newZoomLevel); // Update state
    updateCurrentGridSize(); // Update derived value

    const newCamX = worldPivotX - (pivotX / newZoomLevel);
    const newCamY = worldPivotY - (pivotY / newZoomLevel);
    state.setCamPos(newCamX, newCamY); // Update state camera position

    clampCamera();
}

function updatePanningInput() {
    let dx = 0; dy = 0;
    const panAmount = config.PAN_SPEED_FACTOR * config.BASE_GRID_SIZE;
    if (keys['ArrowLeft'] || keys['KeyA']) dx -= panAmount;
    if (keys['ArrowRight'] || keys['KeyD']) dx += panAmount;
    if (keys['ArrowUp'] || keys['KeyW']) dy -= panAmount;
    if (keys['ArrowDown'] || keys['KeyS']) dy += panAmount;

    if (dx !== 0 || dy !== 0) {
        state.setCamPos(state.camX + dx, state.camY + dy); // Update state
        clampCamera();
    }
}

// --- Rendering ---
function render() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // Clear background
    ctx.fillStyle = '#5a8b5a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Apply camera transform using current state
    ctx.translate(-state.camX * state.zoomLevel, -state.camY * state.zoomLevel);
    ctx.scale(state.zoomLevel, state.zoomLevel);

    // Calculate visible grid range (using current state)
    const viewLeftWorld = state.camX;
    const viewTopWorld = state.camY;
    const viewRightWorld = state.camX + canvas.width / state.zoomLevel;
    const viewBottomWorld = state.camY + canvas.height / state.zoomLevel;
    const startGridX = Math.floor(viewLeftWorld / config.BASE_GRID_SIZE) - 1;
    const endGridX = Math.ceil(viewRightWorld / config.BASE_GRID_SIZE) + 1;
    const startGridY = Math.floor(viewTopWorld / config.BASE_GRID_SIZE) - 1;
    const endGridY = Math.ceil(viewBottomWorld / config.BASE_GRID_SIZE) + 1;

    // Draw Grid
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1 / state.zoomLevel; // Adjust line width based on zoom
    for (let x = startGridX; x <= endGridX; x++) {
        const wx = x * config.BASE_GRID_SIZE;
        ctx.beginPath(); ctx.moveTo(wx, startGridY * config.BASE_GRID_SIZE); ctx.lineTo(wx, endGridY * config.BASE_GRID_SIZE); ctx.stroke();
    }
    for (let y = startGridY; y <= endGridY; y++) {
        const wy = y * config.BASE_GRID_SIZE;
        ctx.beginPath(); ctx.moveTo(startGridX * config.BASE_GRID_SIZE, wy); ctx.lineTo(endGridX * config.BASE_GRID_SIZE, wy); ctx.stroke();
    }

    // Draw Placed Tiles
    const tileFontSize = config.BASE_GRID_SIZE * 0.8;
    ctx.font = `${tileFontSize}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let gx = startGridX; gx < endGridX; gx++) {
        for (let gy = startGridY; gy < endGridY; gy++) {
             if (gx < 0 || gx >= config.WORLD_WIDTH_CELLS || gy < 0 || gy >= config.WORLD_HEIGHT_CELLS) continue;
            const gridKey = `${gx},${gy}`;
            if (state.gridData.has(gridKey)) { // Access gridData from state
                ctx.fillText(state.gridData.get(gridKey), gx * config.BASE_GRID_SIZE + config.BASE_GRID_SIZE / 2, gy * config.BASE_GRID_SIZE + config.BASE_GRID_SIZE / 2);
            }
        }
    }

    // Draw Mouse Hover / Tool Preview
    if (mouseGridX >= 0 && mouseGridY >= 0 && mouseGridX < config.WORLD_WIDTH_CELLS && mouseGridY < config.WORLD_HEIGHT_CELLS &&
        mouseScreenX >= 0 && mouseScreenY >= 0 && mouseScreenX <= canvas.width && mouseScreenY <= canvas.height)
    {
        const hoverWorldX = mouseGridX * config.BASE_GRID_SIZE;
        const hoverWorldY = mouseGridY * config.BASE_GRID_SIZE;
        ctx.lineWidth = 2 / state.zoomLevel; // Consistent visual thickness

        if (state.currentTool === 'build' && state.selectedTile) {
            ctx.globalAlpha = 0.5;
            ctx.fillText(state.selectedTile, hoverWorldX + config.BASE_GRID_SIZE / 2, hoverWorldY + config.BASE_GRID_SIZE / 2);
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
            ctx.strokeRect(hoverWorldX + ctx.lineWidth/2, hoverWorldY + ctx.lineWidth/2, config.BASE_GRID_SIZE - ctx.lineWidth, config.BASE_GRID_SIZE - ctx.lineWidth);
        } else if (state.currentTool === 'bulldoze') {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.strokeRect(hoverWorldX + ctx.lineWidth/2, hoverWorldY + ctx.lineWidth/2, config.BASE_GRID_SIZE - ctx.lineWidth, config.BASE_GRID_SIZE - ctx.lineWidth);
        }
    }

    ctx.restore(); // Restore canvas state
}

// --- Game Loop ---
function gameLoop() {
    updatePanningInput();
    render();
    requestAnimationFrame(gameLoop);
}

// --- Start ---
init();
