/**
 * ObjectPool - Manages a pool of reusable objects to reduce memory allocation overhead.
 *
 * This class maintains a collection of inactive objects that can be reused,
 * improving performance by avoiding frequent object creation and destruction.
 *
 * Note: Depends on a scene object being available for add/remove operations.
 * The scene should be injected or passed to get/release methods in refactored code.
 */
class ObjectPool {
    constructor(createFn, size = 20) {
        this.createFn = createFn;
        this.inactive = [];
        for (let i = 0; i < size; i++) {
            this.inactive.push(this.createFn());
        }
    }

    get() {
        let obj;
        if (this.inactive.length > 0) {
            obj = this.inactive.pop();
        } else {
            // Pool is empty, create a new one as a fallback
            obj = this.createFn();
        }
        scene.add(obj.mesh);
        obj.active = true;
        return obj;
    }

    release(obj) {
        scene.remove(obj.mesh);
        obj.active = false;
        this.inactive.push(obj);
    }

    dispose() {
        this.inactive.forEach(obj => {
            if (obj.mesh.geometry) obj.mesh.geometry.dispose();
            if (obj.mesh.material) {
                if (Array.isArray(obj.mesh.material)) {
                    obj.mesh.material.forEach(m => m.dispose());
                } else {
                    obj.mesh.material.dispose();
                }
            }
        });
        this.inactive = [];
    }
}

export default ObjectPool;
