/**
 * LogBuffer - Captures and stores recent console warnings and errors
 *
 * Intercepts console.warn and console.error calls to maintain a buffer
 * of recent log messages for debugging purposes.
 */

const LogBuffer = {
    buffer: [],
    maxSize: 20, // Store last 20 messages
    originalWarn: console.warn,
    originalError: console.error,

    init() {
        console.warn = (...args) => {
            this.push('WARN', ...args);
            this.originalWarn.apply(console, args);
        };
        console.error = (...args) => {
            this.push('ERROR', ...args);
            this.originalError.apply(console, args);
        };
    },

    push(level, ...args) {
        const message = args.map(arg => {
            if (arg instanceof Error) {
                return arg.stack || arg.message;
            }
            if (typeof arg === 'object' && arg !== null) {
                try {
                    return JSON.stringify(arg);
                } catch (e) {
                    return '[Unserializable Object]';
                }
            }
            return String(arg);
        }).join(' ');
        this.buffer.push(`[${level}] ${new Date().toLocaleTimeString()}: ${message}`);
        if (this.buffer.length > this.maxSize) {
            this.buffer.shift();
        }
    },

    dump() {
        if (this.buffer.length > 0) {
            this.originalError("\n--- Recent Log Buffer (Warnings/Errors) ---");
            this.buffer.forEach(msg => this.originalWarn(msg)); // Use original to avoid re-buffering
            this.originalError("-------------------------------------------\n");
        }
    },

    reset() {
        this.buffer = [];
    }
};

export default LogBuffer;
