/**
 * Premisia Geometric Loaders
 * Easy-to-use loading animations for your website
 */

class PremisiaLoader {
    constructor() {
        this.activeLoaders = new Map();
        this.loadingMessages = [
            "Analyzing strategic vision...",
            "Processing your request...",
            "Generating insights...",
            "Building your program...",
            "Optimizing strategy...",
            "Validating decisions...",
            "Applying AI analysis...",
            "Creating your roadmap...",
            "Thinking it through..."
        ];
    }

    /**
     * Show a full page loader
     * @param {string} type - Type of loader animation
     * @param {string} message - Loading message to display
     * @returns {string} - Loader ID for later removal
     */
    showFullPageLoader(type = 'fractal', message = null) {
        const loaderId = 'loader-' + Date.now();
        const loaderHTML = this.getLoaderHTML(type);
        const loadingMessage = message || this.getRandomMessage();
        
        const overlay = document.createElement('div');
        overlay.id = loaderId;
        overlay.className = 'premisia-loader-overlay';
        overlay.innerHTML = `
            <div class="premisia-loader">
                <div class="premisia-logo-loader">PREMISIA</div>
                ${loaderHTML}
                <div class="loading-text">${loadingMessage}</div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        this.activeLoaders.set(loaderId, overlay);
        
        // Add fade-in effect
        setTimeout(() => {
            overlay.style.opacity = '1';
        }, 10);
        
        return loaderId;
    }

    /**
     * Hide a specific loader
     * @param {string} loaderId - ID of the loader to hide
     */
    hideLoader(loaderId) {
        const loader = this.activeLoaders.get(loaderId);
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.remove();
                this.activeLoaders.delete(loaderId);
            }, 500);
        }
    }

    /**
     * Hide all active loaders
     */
    hideAllLoaders() {
        this.activeLoaders.forEach((loader, id) => {
            this.hideLoader(id);
        });
    }

    /**
     * Add loader to a button
     * @param {HTMLElement} button - Button element
     * @param {string} type - Type of loader animation
     */
    addButtonLoader(button, type = 'orbit') {
        const originalContent = button.innerHTML;
        button.classList.add('btn-loading');
        button.disabled = true;
        
        const loaderHTML = this.getSmallLoaderHTML(type);
        button.innerHTML = `
            <span class="btn-text" style="opacity: 0">${originalContent}</span>
            <div class="btn-loader">${loaderHTML}</div>
        `;
        
        // Return a function to restore the button
        return () => {
            button.classList.remove('btn-loading');
            button.disabled = false;
            button.innerHTML = originalContent;
        };
    }

    /**
     * Add inline loader to an element
     * @param {HTMLElement} element - Target element
     * @param {string} position - Position: 'before', 'after', 'replace'
     */
    addInlineLoader(element, position = 'after') {
        const loader = document.createElement('span');
        loader.className = 'inline-loader dots-loader';
        loader.innerHTML = `
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
        `;
        
        switch(position) {
            case 'before':
                element.parentNode.insertBefore(loader, element);
                break;
            case 'after':
                element.parentNode.insertBefore(loader, element.nextSibling);
                break;
            case 'replace':
                element.style.display = 'none';
                element.parentNode.insertBefore(loader, element.nextSibling);
                break;
        }
        
        return () => {
            loader.remove();
            if (position === 'replace') {
                element.style.display = '';
            }
        };
    }

    /**
     * Show loader in a specific container
     * @param {HTMLElement} container - Container element
     * @param {string} type - Type of loader animation
     */
    showInContainer(container, type = 'hexagon') {
        const loaderHTML = this.getLoaderHTML(type);
        const originalContent = container.innerHTML;
        
        container.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; min-height: 200px;">
                ${loaderHTML}
            </div>
        `;
        
        return () => {
            container.innerHTML = originalContent;
        };
    }

    /**
     * Get loader HTML based on type
     */
    getLoaderHTML(type) {
        const loaders = {
            'cube': `
                <div class="cube-loader">
                    <div class="cube-face"></div>
                    <div class="cube-face"></div>
                    <div class="cube-face"></div>
                    <div class="cube-face"></div>
                    <div class="cube-face"></div>
                    <div class="cube-face"></div>
                </div>`,
            'triangle': `
                <div class="triangle-morph">
                    <div class="triangle-shape"></div>
                </div>`,
            'dna': `
                <div class="dna-loader">
                    <div class="dna-strand">
                        <div class="dna-node"></div>
                        <div class="dna-node"></div>
                        <div class="dna-node"></div>
                        <div class="dna-node"></div>
                    </div>
                    <div class="dna-strand">
                        <div class="dna-node"></div>
                        <div class="dna-node"></div>
                        <div class="dna-node"></div>
                        <div class="dna-node"></div>
                    </div>
                </div>`,
            'hexagon': `
                <div class="hexagon-loader">
                    <div class="hexagon"></div>
                </div>`,
            'orbit': `
                <div class="orbit-loader">
                    <div class="orbit-center"></div>
                    <div class="orbit-ring">
                        <div class="orbit-dot"></div>
                    </div>
                    <div class="orbit-ring">
                        <div class="orbit-dot"></div>
                    </div>
                    <div class="orbit-ring">
                        <div class="orbit-dot"></div>
                    </div>
                </div>`,
            'fractal': `
                <div class="fractal-loader">
                    <div class="fractal-square"></div>
                    <div class="fractal-square"></div>
                    <div class="fractal-square"></div>
                    <div class="fractal-square"></div>
                </div>`,
            'network': `
                <div class="network-loader">
                    <div class="network-line"></div>
                    <div class="network-line"></div>
                    <div class="network-line"></div>
                    <div class="network-node"></div>
                    <div class="network-node"></div>
                    <div class="network-node"></div>
                    <div class="network-node"></div>
                </div>`,
            'ripple': `
                <div class="ripple-loader">
                    <div class="ripple-ring"></div>
                    <div class="ripple-ring"></div>
                    <div class="ripple-ring"></div>
                </div>`,
            'tessellation': `
                <div class="tessellation-loader">
                    <div class="tess-tile"></div>
                    <div class="tess-tile"></div>
                    <div class="tess-tile"></div>
                    <div class="tess-tile"></div>
                    <div class="tess-tile"></div>
                    <div class="tess-tile"></div>
                    <div class="tess-tile"></div>
                    <div class="tess-tile"></div>
                    <div class="tess-tile"></div>
                </div>`,
            'infinity': `
                <div class="infinity-loader">
                    <div class="infinity-shape"></div>
                </div>`
        };
        
        return loaders[type] || loaders['fractal'];
    }

    /**
     * Get small loader HTML for buttons
     */
    getSmallLoaderHTML(type) {
        const loaders = {
            'orbit': `
                <div class="orbit-loader orbit-loader-small">
                    <div class="orbit-center"></div>
                    <div class="orbit-ring">
                        <div class="orbit-dot"></div>
                    </div>
                </div>`,
            'hexagon': `
                <div class="hexagon-loader hexagon-loader-small">
                    <div class="hexagon"></div>
                </div>`,
            'dots': `
                <div class="dots-loader">
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                </div>`
        };
        
        return loaders[type] || loaders['dots'];
    }

    /**
     * Get random loading message
     */
    getRandomMessage() {
        return this.loadingMessages[Math.floor(Math.random() * this.loadingMessages.length)];
    }

    /**
     * Promise-based loader
     * Shows loader during async operation
     */
    async withLoader(asyncFunction, type = 'fractal', message = null) {
        const loaderId = this.showFullPageLoader(type, message);
        try {
            const result = await asyncFunction();
            this.hideLoader(loaderId);
            return result;
        } catch (error) {
            this.hideLoader(loaderId);
            throw error;
        }
    }

    /**
     * Show loading progress with steps
     */
    showProgressLoader(steps = []) {
        const loaderId = 'progress-' + Date.now();
        let currentStep = 0;
        
        const overlay = document.createElement('div');
        overlay.id = loaderId;
        overlay.className = 'premisia-loader-overlay';
        overlay.innerHTML = `
            <div class="premisia-loader">
                <div class="premisia-logo-loader">PREMISIA</div>
                ${this.getLoaderHTML('fractal')}
                <div class="loading-text">${steps[0] || 'Initializing...'}</div>
                <div class="progress-steps" style="margin-top: 20px; color: #94a3b8; font-size: 12px;">
                    Step 1 of ${steps.length}
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        this.activeLoaders.set(loaderId, overlay);
        
        return {
            nextStep: () => {
                currentStep++;
                if (currentStep < steps.length) {
                    overlay.querySelector('.loading-text').textContent = steps[currentStep];
                    overlay.querySelector('.progress-steps').textContent = `Step ${currentStep + 1} of ${steps.length}`;
                }
            },
            complete: () => {
                this.hideLoader(loaderId);
            }
        };
    }
}

// Create global instance
window.PremisiaLoader = new PremisiaLoader();

// Auto-initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    // Add loader to elements with data-loader attribute
    document.querySelectorAll('[data-loader]').forEach(element => {
        const loaderType = element.getAttribute('data-loader');
        
        if (element.tagName === 'BUTTON') {
            element.addEventListener('click', function() {
                const restore = PremisiaLoader.addButtonLoader(this, loaderType);
                // Simulate async operation
                setTimeout(restore, 2000);
            });
        }
    });
    
    // Add page load animation
    if (document.querySelector('[data-page-loader]')) {
        const loaderId = PremisiaLoader.showFullPageLoader('fractal', 'Loading Premisia...');
        window.addEventListener('load', function() {
            setTimeout(() => {
                PremisiaLoader.hideLoader(loaderId);
            }, 1000);
        });
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PremisiaLoader;
}