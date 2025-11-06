/**
 * SpatialGrid - Spatial partitioning system for efficient proximity queries.
 *
 * Divides space into a grid of cells to quickly find nearby objects without
 * checking every object in the scene. Useful for collision detection and
 * area-of-effect calculations.
 */
class SpatialGrid {
    constructor(width, height, cellSize) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.gridWidth = Math.ceil(width / cellSize);
        this.gridHeight = Math.ceil(height / cellSize);
        this.clear();
    }

    getCellCoords(x, z) {
        const gridX = Math.floor((x + this.width / 2) / this.cellSize);
        const gridZ = Math.floor((z + this.height / 2) / this.cellSize);
        return { gridX, gridZ };
    }

    getCellIndexFromCoords(gridX, gridZ) {
        if (gridX < 0 || gridX >= this.gridWidth || gridZ < 0 || gridZ >= this.gridHeight) return -1;
        return gridZ * this.gridWidth + gridX;
    }

    clear() {
        this.grid = new Array(this.gridWidth * this.gridHeight).fill(0).map(() => []);
    }

    add(obj) {
        // Safety check for valid object and position
        if (!obj || !obj.mesh || !obj.mesh.position) return;

        const x = obj.mesh.position.x;
        const z = obj.mesh.position.z;

        // Check for invalid coordinates (NaN or undefined)
        if (typeof x !== 'number' || typeof z !== 'number' || isNaN(x) || isNaN(z)) {
            console.warn('SpatialGrid: Invalid position detected', x, z);
            return;
        }

        const { gridX, gridZ } = this.getCellCoords(x, z);
        const index = this.getCellIndexFromCoords(gridX, gridZ);

        if (index !== -1 && this.grid[index]) {
            this.grid[index].push(obj);
        }
    }

    getNearby(obj) { // obj is { mesh, radius }
        const nearby = new Set();
        const position = obj.mesh.position;
        const radius = obj.radius || 0; // Use radius if provided, else 0
        const { gridX, gridZ } = this.getCellCoords(position.x, position.z);
        const cellRadius = Math.max(1, Math.ceil(radius / this.cellSize));

        for (let dz = -cellRadius; dz <= cellRadius; dz++) {
            for (let dx = -cellRadius; dx <= cellRadius; dx++) {
                const checkX = gridX + dx;
                const checkZ = gridZ + dz;
                const index = this.getCellIndexFromCoords(checkX, checkZ);
                if (index !== -1) {
                    this.grid[index].forEach(item => nearby.add(item));
                }
            }
        }
        return Array.from(nearby);
    }
}

export default SpatialGrid;
