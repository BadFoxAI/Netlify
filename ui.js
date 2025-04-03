import * as config from './config.js';
import * as state from './state.js';
import { drawGeneratedTile } from './drawingUtils.js'; // Import drawing function for preview

// --- DOM Element References --- (Added slider/layer refs)
export const paletteDiv = document.getElementById('palette');
export const selectedTileDisplay = document.getElementById('selectedTileDisplay');
export const coordsDisplay = document.getElementById('coordsDisplay');
export const buildToolBtn = document.getElementById('buildToolBtn');
export const bulldozeToolBtn = document.getElementById('bulldozeToolBtn');
export const saveFileBtn = document.getElementById('saveFileBtn');
export const loadFileBtn = document.getElementById('loadFileBtn');
export const clearSaveBtn = document.getElementById('clearSaveBtn');
export const clearConfirmDiv = document.getElementById('clearConfirm');
export const clearConfirmYesBtn = document.getElementById('clearConfirmYes');
export const clearConfirmNoBtn = document.getElementById('clearConfirmNo');
export const saveStatus = document.getElementById('saveStatus');
export const fileInput = document.getElementById('fileInput');
export const zoomInBtn = document.getElementById('zoomInBtn');
export const zoomOutBtn = document.getElementById('zoomOutBtn');
export const undoBtn = document.getElementById('undoBtn');
export const redoBtn = document.getElementById('redoBtn');
export const sizeSlider = document.getElementById('sizeSlider');
export const sizeDisplay = document.getElementById('sizeDisplay');
export const layerDownBtn = document.getElementById('layerDownBtn');
export const layerUpBtn = document.getElementById('layerUpBtn');
export const layerDisplay = document.getElementById('layerDisplay');

let statusTimeout;

// --- UI Update Functions ---
export function populatePalette() {
    paletteDiv.innerHTML = '<h2>Palette</h2>';
    const tempCanvasSize = 28; // Match span size for preview drawing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = tempCanvasSize;
    tempCanvas.height = tempCanvasSize;
    const tempCtx = tempCanvas.getContext('2d');

    for (const category in config.TILE_CATEGORIES) {
        const catDiv = document.createElement('div'); catDiv.className = 'tile-category';
        const title = document.createElement('h3'); title.textContent = category; catDiv.appendChild(title);

        config.TILE_CATEGORIES[category].forEach(tileId => {
            const span = document.createElement('span');
            span.dataset.tile = tileId;
            span.title = `Build ${tileId}`;

            if (config.GENERATED_TILE_IDS.has(tileId)) {
                // Draw preview for generated tile
                tempCtx.clearRect(0, 0, tempCanvasSize, tempCanvasSize);
                 // Temporarily set scale to 1 for drawing preview
                const currentTransform = tempCtx.getTransform();
                tempCtx.setTransform(1, 0, 0, 1, 0, 0);
                drawGeneratedTile(tempCtx, 0, 0, tempCanvasSize, tileId);
                tempCtx.setTransform(currentTransform); // Restore transform

                span.style.backgroundImage = `url(${tempCanvas.toDataURL()})`;
                span.style.backgroundSize = 'cover';
                // span.textContent = ' '; // Optional: Hide text if background shows well
            } else {
                // Display emoji directly
                span.textContent = tileId;
            }

            span.onclick = () => {
                selectTile(tileId); // Selects tile AND sets default layer
                setTool('build');
            };
            catDiv.appendChild(span);
        });
        paletteDiv.appendChild(catDiv);
    }
}


export function selectTile(tileId) {
    state.setSelectedTile(tileId);
    const defaultLayer = config.getDefaultLayerForTile(tileId);
    selectLayer(defaultLayer); // Automatically set layer based on tile

    // Update visual selection in palette
    const spans = paletteDiv.querySelectorAll('span');
    spans.forEach(span => {
        span.classList.toggle('selected-tile', span.dataset.tile === tileId);
    });

    // Update selected tile display (show emoji or ID)
    if (config.GENERATED_TILE_IDS.has(tileId)) {
         selectedTileDisplay.textContent = ` ${tileId} `; // Show ID for generated
         selectedTileDisplay.style.fontSize = '14px'; // Smaller font for ID
         selectedTileDisplay.style.fontFamily = 'monospace';
         // Could potentially draw a small preview here too
    } else {
         selectedTileDisplay.textContent = tileId; // Show emoji
         selectedTileDisplay.style.fontSize = '24px'; // Reset font size
         selectedTileDisplay.style.fontFamily = 'sans-serif';
    }
}

export function selectSize(size) { /* ... Unchanged ... */ state.setSelectedSize(size); updateSizeUI(); }
export function updateSizeUI() { /* ... Unchanged ... */ const s=state.selectedSize; sizeSlider.value=s; sizeDisplay.textContent=`${s}x${s}`; }
export function selectLayer(layer) { /* ... Unchanged ... */ state.setSelectedLayer(layer); updateLayerUI(); }
export function updateLayerUI() { /* ... Unchanged ... */ layerDisplay.textContent = state.selectedLayer; }
export function setTool(toolName) { /* ... Unchanged ... */ state.setCurrentTool(toolName); updateToolUI(); }
export function updateToolUI() { /* ... Unchanged ... */ selectedTileDisplay.style.display = state.currentTool === 'build' ? 'inline' : 'none'; buildToolBtn.classList.toggle('active-tool', state.currentTool === 'build'); bulldozeToolBtn.classList.toggle('active-tool', state.currentTool === 'bulldoze'); }
export function updateCoordsDisplay(gx, gy) { /* ... Unchanged ... */ coordsDisplay.textContent = `Grid: ${gx},${gy}`; }
export function updateUndoRedoButtons() { /* ... Unchanged ... */ undoBtn.disabled = state.undoStack.length === 0; redoBtn.disabled = state.redoStack.length === 0; }
export function showStatusMessage(message, isSuccess) { /* ... Unchanged ... */ if (statusTimeout) clearTimeout(statusTimeout); saveStatus.textContent = message; saveStatus.style.color = isSuccess ? '#8f8' : '#f88'; statusTimeout = setTimeout(() => { saveStatus.textContent = ''; }, 3000); }
export function showClearConfirmation() { /* ... Unchanged ... */ clearConfirmDiv.style.display = 'block'; }
export function hideClearConfirmation() { /* ... Unchanged ... */ clearConfirmDiv.style.display = 'none'; }
