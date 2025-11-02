/**
 * ErrorWatcher - Tracks and manages error reporting to prevent console spam.
 *
 * Monitors errors and limits the number of times each unique error is logged,
 * preventing the console from being flooded with repeated errors.
 */
const ErrorWatcher = {
    errors: {},
    maxReports: 5,

    report(error) {
        const key = error.message || 'Unknown error';
        if (!this.errors[key]) {
            this.errors[key] = { count: 0, firstSeen: new Date(), error: error };
        }
        this.errors[key].count++;
        if (this.errors[key].count <= this.maxReports) {
            console.error("Caught error in game loop:", error);
        } else if (this.errors[key].count === this.maxReports + 1) {
            console.warn(`Suppressing further logs for error: "${key}". First seen at ${this.errors[key].firstSeen}.`);
        }
    },

    reset() {
        this.errors = {};
    }
};

export default ErrorWatcher;
