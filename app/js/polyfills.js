// UUID v4 polyfill
if (!crypto.randomUUID) {
    const hexDigits = '0123456789abcdef';
    const s4 = () => {
        const bytes = new Uint8Array(4);
        crypto.getRandomValues(bytes);
        return Array.from(bytes).map(b => hexDigits[b >> 4] + hexDigits[b & 15]).join('');
    };

    crypto.randomUUID = function() {
        // Generate the timestamp variant (version 4)
        const timeHex = s4() + s4();
        
        // Insert version number (4)
        const clockSeqHex = s4();
        const clockSeqHi = ((parseInt(clockSeqHex.charAt(0), 16) & 0x3) | 0x8).toString(16);
        const clockSeqLow = clockSeqHex.substr(1);
        
        // Generate node section
        const node = s4() + s4() + s4();
        
        // Assemble UUID with dashes and version number
        return `${timeHex.substr(0, 8)}-${timeHex.substr(8, 4)}-4${timeHex.substr(13, 3)}-${clockSeqHi}${clockSeqLow}-${node}`;
    };
}

// Fallback for older browsers that don't support crypto.getRandomValues
if (!crypto.getRandomValues) {
    const getRandomInt = (min, max) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    crypto.getRandomValues = function(array) {
        if (!(array instanceof Int8Array || array instanceof Uint8Array || 
              array instanceof Int16Array || array instanceof Uint16Array || 
              array instanceof Int32Array || array instanceof Uint32Array || 
              array instanceof Uint8ClampedArray)) {
            throw new TypeError('Expected an integer array');
        }
        
        for (let i = 0; i < array.length; i++) {
            if (array instanceof Uint8Array || array instanceof Int8Array) {
                array[i] = getRandomInt(0, 255);
            } else if (array instanceof Uint16Array || array instanceof Int16Array) {
                array[i] = getRandomInt(0, 65535);
            } else if (array instanceof Uint32Array || array instanceof Int32Array) {
                array[i] = getRandomInt(0, 4294967295);
            }
        }
        
        return array;
    };
}

// Fallback for browsers without crypto
if (typeof crypto === 'undefined') {
    window.crypto = {
        getRandomValues: function(array) {
            if (!(array instanceof Int8Array || array instanceof Uint8Array || 
                  array instanceof Int16Array || array instanceof Uint16Array || 
                  array instanceof Int32Array || array instanceof Uint32Array || 
                  array instanceof Uint8ClampedArray)) {
                throw new TypeError('Expected an integer array');
            }
            
            for (let i = 0; i < array.length; i++) {
                if (array instanceof Uint8Array || array instanceof Int8Array) {
                    array[i] = Math.floor(Math.random() * 256);
                } else if (array instanceof Uint16Array || array instanceof Int16Array) {
                    array[i] = Math.floor(Math.random() * 65536);
                } else if (array instanceof Uint32Array || array instanceof Int32Array) {
                    array[i] = Math.floor(Math.random() * 4294967296);
                }
            }
            
            return array;
        },
        
        randomUUID: function() {
            const hexDigits = '0123456789abcdef';
            const s4 = () => {
                const bytes = new Uint8Array(4);
                this.getRandomValues(bytes);
                return Array.from(bytes).map(b => hexDigits[b >> 4] + hexDigits[b & 15]).join('');
            };
            
            const timeHex = s4() + s4();
            const clockSeqHex = s4();
            const clockSeqHi = ((parseInt(clockSeqHex.charAt(0), 16) & 0x3) | 0x8).toString(16);
            const clockSeqLow = clockSeqHex.substr(1);
            const node = s4() + s4() + s4();
            
            return `${timeHex.substr(0, 8)}-${timeHex.substr(8, 4)}-4${timeHex.substr(13, 3)}-${clockSeqHi}${clockSeqLow}-${node}`;
        }
    };
}