import * as config from './config.js';
// Removed updateLayerUI import as it's handled internally by selectTile now
import { showStatusMessage, updateUndoRedoButtons, selectTile, updateSizeUI } from './ui.js';

// --- Game State Variables ---
export let camX = 0; export let camY = 0; export let zoomLevel = 1.0;
// NEW gridData structure: Map<string, { [layer: number]: TileData }>
// TileData = string | { tile: string, size: number, isOrigin: true } | { originX: number, originY: number, isOrigin: false }
export let gridData = new Map();
export let selectedTile = config.DEFAULT_TILE; export let selectedSize = config.DEFAULT_SIZE;
export let currentPlacementLayer = config.getDefaultLayerForTile(config.DEFAULT_TILE); // Layer derived from selected tile
export let currentTool = 'build'; export let undoStack = []; export let redoStack = [];

// --- State Modifiers ---
export function setCamPos(x, y) { camX = x; camY = y; } export function setZoomLevel(level) { zoomLevel = level; }
export function setGridData(dataMap) { gridData = dataMap; }
export function setSelectedTile(tileId) {
    selectedTile = tileId;
    currentPlacementLayer = config.getDefaultLayerForTile(tileId);
}
export function setSelectedSize(size) { selectedSize = Math.max(1, Math.min(size, config.MAX_BUILD_SIZE)); }
// setSelectedLayer is removed
export function setCurrentTool(tool) { currentTool = tool; }

// --- Helper: Get Info for the TOPMOST relevant tile/object at coordinates ---
// Returns null if empty, or an object like:
// { tile, size, layer, isOrigin, originX, originY }
// If the coordinate contains a part of a multi-tile object, it returns the info
// of the object's origin, but with isOrigin: false.
export function getEffectiveTileInfo(gx, gy) {
    const key = `${gx},${gy}`;
    const layerMap = gridData.get(key);
    if (!layerMap) return null; // Nothing at this coordinate

    let topmostLayer = -Infinity;
    let topmostData = null;
    let topmostLayerKey = -1; // Store the key (layer number) of the topmost data

    // Find the highest layer number present at this coordinate
    for (const layerStr in layerMap) {
        const layer = parseInt(layerStr, 10);
        if (layer > topmostLayer) {
            topmostLayer = layer;
            topmostData = layerMap[layer];
            topmostLayerKey = layer;
        }
    }

    if (topmostData === null || topmostLayer === -Infinity) return null; // No valid data found

    // Now process the data found on the highest layer
    if (typeof topmostData === 'string') {
        // Simple tile string on the highest layer
        return { tile: topmostData, size: 1, layer: topmostLayer, isOrigin: true, originX: gx, originY: gy };
    } else if (typeof topmostData === 'object' && topmostData !== null) {
        if (topmostData.isOrigin) {
            // It's the origin of a multi-tile object on the highest layer
            return {
                tile: topmostData.tile,
                size: topmostData.size || 1,
                layer: topmostLayer, // Use the layer it was found on
                isOrigin: true,
                originX: gx,
                originY: gy
            };
        } else {
            // It's part of a multi-tile object on the highest layer, find the origin
            const originKey = `${topmostData.originX},${topmostData.originY}`;
            const originLayerMap = gridData.get(originKey);
            // IMPORTANT: The origin data MUST exist on the *same layer* as the part
            const originData = originLayerMap ? originLayerMap[topmostLayerKey] : null;

            if (typeof originData === 'object' && originData?.isOrigin) {
                // Return info based on the origin, but mark isOrigin false for this cell
                return {
                    tile: originData.tile,
                    size: originData.size || 1,
                    layer: topmostLayer, // The layer this part exists on
                    isOrigin: false, // This specific cell is not the origin
                    originX: topmostData.originX, // Reference to the actual origin coords
                    originY: topmostData.originY
                };
            } else {
                console.warn(`Orphaned multi-tile part found at ${gx},${gy}, layer ${topmostLayer} ref ${topmostData.originX},${topmostData.originY}`);
                return null; // Treat as invalid/empty
            }
        }
    }

    return null; // Should not happen if topmostData was found, but safety fallback
}


// --- Undo/Redo Logic --- (Unchanged - uses layer maps)
// actionData = { type: 'place'/'bulldoze', cells: [ { key, oldLayerMap, newLayerMap }, ... ] }
export function performAction(actionData) { actionData.cells.forEach(({key,newLayerMap})=>{if(newLayerMap===null||Object.keys(newLayerMap).length===0){gridData.delete(key);}else{gridData.set(key,newLayerMap);}}); undoStack.push(actionData); if(undoStack.length>config.MAX_UNDO_STEPS){undoStack.shift();} redoStack=[]; updateUndoRedoButtons(); saveGameToLocal(); }
export function undo() { if(undoStack.length===0)return; const actionData=undoStack.pop(); actionData.cells.forEach(({key,oldLayerMap})=>{if(oldLayerMap===null||Object.keys(oldLayerMap).length===0){gridData.delete(key);}else{gridData.set(key,oldLayerMap);}}); redoStack.push(actionData); updateUndoRedoButtons(); saveGameToLocal(); }
export function redo() { if(redoStack.length===0)return; const actionData=redoStack.pop(); actionData.cells.forEach(({key,newLayerMap})=>{if(newLayerMap===null||Object.keys(newLayerMap).length===0){gridData.delete(key);}else{gridData.set(key,newLayerMap);}}); undoStack.push(actionData); updateUndoRedoButtons(); saveGameToLocal(); }

// --- Save/Load Logic --- (Unchanged - handles layer maps, v9)
export function saveGameToLocal() { try { const gridObject={}; gridData.forEach((value,key)=>{gridObject[key]=value;}); const saveData={version:9,grid:gridObject,camera:{x:camX,y:camY},zoom:zoomLevel,selected:selectedTile,selectedSize:selectedSize}; localStorage.setItem(config.SAVE_KEY,JSON.stringify(saveData));}catch(error){console.error("LS Save Error:",error);showStatusMessage("Error autosaving!",false);}}
export function loadGameFromLocal() { const savedString=localStorage.getItem(config.SAVE_KEY); let loadedSuccessfully=false; gridData=new Map(); if(savedString){ try{ const saveData=JSON.parse(savedString); const dataVersion=saveData.version||0; if(dataVersion>=9){const gridObject=saveData.grid||{}; for(const key in gridObject){if(Object.hasOwnProperty.call(gridObject,key)){gridData.set(key,gridObject[key]);}}} else{console.warn(`Loading unsupported save v${dataVersion}. Grid empty.`);} setCamPos(saveData.camera?.x||0,saveData.camera?.y||0); setZoomLevel(saveData.zoom||1.0); setSelectedSize(saveData.selectedSize||config.DEFAULT_SIZE); selectTile(saveData.selected||config.DEFAULT_TILE); showStatusMessage("Game Loaded from Local Storage!",true); loadedSuccessfully=true; }catch(error){console.error("Error loading game from localStorage:",error); showStatusMessage("Error loading local save.",false); gridData=new Map();}} if(!loadedSuccessfully){ gridData=new Map(); setCamPos(0,0); setZoomLevel(1.0); setSelectedSize(config.DEFAULT_SIZE); selectTile(config.DEFAULT_TILE); if(!savedString)showStatusMessage("No local save data found.",false);} updateSizeUI(); /* updateLayerUI removed */ undoStack=[]; redoStack=[]; updateUndoRedoButtons(); return loadedSuccessfully;}
export function saveGameToFile() { try { const gridObject={}; gridData.forEach((v,k)=>{gridObject[k]=v;}); const saveData={version:9,description:"SimEmoji Save",grid:gridObject,camera:{x:camX,y:camY},zoom:zoomLevel,selected:selectedTile,selectedSize:selectedSize}; const jsonString=JSON.stringify(saveData,null,2); const blob=new Blob([jsonString],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`simemoji_save_${Date.now()}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); showStatusMessage("Game Saved to File!",true); saveGameToLocal(); } catch (error){console.error("File Save Error:",error);showStatusMessage("Error saving to file.",false);}}
export function loadGameFromFile(file) { if(!file)return; const reader=new FileReader(); reader.onload=(e)=>{ try{ const jsonString=e.target.result; const saveData=JSON.parse(jsonString); if(!saveData.grid||!saveData.camera||saveData.version!==9){throw new Error("Invalid or incompatible save file format (v9 required).");} gridData=new Map(); const gridObject=saveData.grid||{}; for(const key in gridObject){if(Object.hasOwnProperty.call(gridObject,key)){gridData.set(key,gridObject[key]);}} setCamPos(saveData.camera.x||0,saveData.camera.y||0); setZoomLevel(saveData.zoom||1.0); setSelectedSize(saveData.selectedSize||config.DEFAULT_SIZE); selectTile(saveData.selected||config.DEFAULT_TILE); showStatusMessage(`Loaded "${file.name}"!`,true); undoStack=[]; redoStack=[]; updateUndoRedoButtons(); saveGameToLocal(); window.dispatchEvent(new Event('stateLoaded')); }catch(error){console.error("File Load Error:",error);showStatusMessage(`Error loading file: ${error.message}`,false);}}; reader.onerror=(e)=>{console.error("FileReader error:",e);showStatusMessage("Error reading file.",false);}; reader.readAsText(file);}
export function confirmClearSaveData() { try { localStorage.removeItem(config.SAVE_KEY); showStatusMessage("Local save data cleared.",true); setGridData(new Map()); setCamPos(0,0); setZoomLevel(1.0); selectTile(config.DEFAULT_TILE); selectSize(config.DEFAULT_SIZE); setCurrentTool('build'); undoStack=[]; redoStack=[]; updateUndoRedoButtons(); window.dispatchEvent(new Event('stateLoaded')); } catch (error){console.error("Error clearing save data:",error);showStatusMessage("Error clearing save data.",false);}}
