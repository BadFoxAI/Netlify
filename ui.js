import * as config from './config.js';
import * as state from './state.js';
import { drawGeneratedTile } from './drawingUtils.js';

// --- DOM Element References ---
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
export const layerDisplay = document.getElementById('layerDisplay'); // This is the span holding the number

let statusTimeout;

// --- UI Update Functions ---
export function populatePalette() {
    paletteDiv.innerHTML = '<h2>Palette</h2>';
    const tempCanvasSize = 26; // Slightly smaller than span size for padding effect
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = tempCanvasSize;
    tempCanvas.height = tempCanvasSize;
    const tempCtx = tempCanvas.getContext('2d');

    for (const category in config.TILE_CATEGORIES) {
        const catDiv = document.createElement('div');
        catDiv.className = 'tile-category';
        const title = document.createElement('h3');
        title.textContent = category;
        catDiv.appendChild(title);

        config.TILE_CATEGORIES[category].forEach(tileId => {
            const span = document.createElement('span');
            span.dataset.tile = tileId;
            span.title = `Build ${tileId}`;

            if (config.GENERATED_TILE_IDS.has(tileId)) {
                // Draw preview for generated tile onto its background
                tempCtx.clearRect(0, 0, tempCanvasSize, tempCanvasSize);
                const currentTransform = tempCtx.getTransform();
                tempCtx.setTransform(1, 0, 0, 1, 0, 0); // Ensure 1:1 scale for preview drawing
                drawGeneratedTile(tempCtx, 0, 0, tempCanvasSize, tileId); // Draw filling the temp canvas
                tempCtx.setTransform(currentTransform); // Restore original transform

                span.style.backgroundImage = `url(${tempCanvas.toDataURL()})`;
                span.style.backgroundSize = 'cover'; // Ensure image covers the span
                span.textContent = ''; // Clear text for generated tiles
            } else {
                // Display emoji directly, ensure no background image interferes
                span.style.backgroundImage = 'none';
                span.textContent = tileId;
            }

            span.onclick = () => {
                selectTile(tileId); // Selects tile AND sets its default layer
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
        selectedTileDisplay.textContent = ` ${tileId.replace('T_', '')} `; // Show shortened ID
        selectedTileDisplay.style.fontSize = '14px';
        selectedTileDisplay.style.fontFamily = 'monospace';
        selectedTileDisplay.title = tileId; // Show full ID on hover
    } else {
        selectedTileDisplay.textContent = tileId; // Show emoji
        selectedTileDisplay.style.fontSize = '24px';
        selectedTileDisplay.style.fontFamily = 'sans-serif';
        selectedTileDisplay.title = ''; // Clear hover title
    }
}

export function selectSize(size) {
    state.setSelectedSize(size); // Update state
    updateSizeUI(); // Update slider and display
}

export function updateSizeUI() {
    const size = state.selectedSize;
    if (sizeSlider.value !== String(size)) { // Prevent updating if already correct (avoids slider jump)
        sizeSlider.value = size;
    }
    sizeDisplay.textContent = `${size}x${size}`;
}

export function selectLayer(layer) {
    state.setSelectedLayer(layer); // Update state (clamps value)
    updateLayerUI(); // Update display
}

export function updateLayerUI() {
    // This function just updates the number display, styling handled elsewhere
    layerDisplay.textContent = state.selectedLayer;
}

export function setTool(toolName) {
    state.setCurrentTool(toolName);
    updateToolUI();
}

export function updateToolUI() {
    selectedTileDisplay.style.display = state.currentTool === 'build' ? 'inline-block' : 'none'; // Use inline-block
    buildToolBtn.classList.toggle('active-tool', state.currentTool === 'build');
    bulldozeToolBtn.classList.toggle('active-tool', state.currentTool === 'bulldoze');
}

export function updateCoordsDisplay(gx, gy) {
    coordsDisplay.textContent = `Grid: ${gx},${gy}`;
}

export function updateUndoRedoButtons() {
    undoBtn.disabled = state.undoStack.length === 0;
    redoBtn.disabled = state.redoStack.length === 0;
}

export function showStatusMessage(message, isSuccess) {
    if (statusTimeout) clearTimeout(statusTimeout);
    saveStatus.textContent = message;
    saveStatus.style.color = isSuccess ? '#8f8' : '#f88';
    statusTimeout = setTimeout(() => { saveStatus.textContent = ''; }, 3000);
}

export function showClearConfirmation() {
    clearConfirmDiv.style.display = 'block';
}

export function hideClearConfirmation() {
    clearConfirmDiv.style.display = 'none';
}
