class LayoutManager {
    constructor() {
        this.sidebar = document.getElementById('sidebar');
        this.resizer = document.getElementById('sidebar-resizer');
        this.collapseButton = document.getElementById('collapse-sidebar');
        this.toggleButton = document.getElementById('toggle-sidebar');
        
        this.isResizing = false;
        this.isSidebarCollapsed = false;
        this.lastSidebarWidth = this.sidebar.offsetWidth;

        this.initializeResizer();
        this.initializeSidebarToggle();
        this.initializeResponsiveLayout();
        this.loadLayoutState();
    }

    initializeResizer() {
        // Mouse events for desktop
        this.resizer.addEventListener('mousedown', this.startResizing.bind(this));
        document.addEventListener('mousemove', this.resize.bind(this));
        document.addEventListener('mouseup', this.stopResizing.bind(this));

        // Touch events for mobile
        this.resizer.addEventListener('touchstart', this.startResizing.bind(this));
        document.addEventListener('touchmove', this.resize.bind(this));
        document.addEventListener('touchend', this.stopResizing.bind(this));
    }

    initializeSidebarToggle() {
        this.collapseButton.addEventListener('click', () => {
            this.toggleSidebar();
        });

        this.toggleButton.addEventListener('click', () => {
            this.showSidebar();
        });

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                if (!this.sidebar.contains(e.target) && 
                    !this.toggleButton.contains(e.target) &&
                    this.sidebar.classList.contains('show')) {
                    this.hideSidebar();
                }
            }
        });
    }

    initializeResponsiveLayout() {
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        mediaQuery.addEventListener('change', () => {
            if (!mediaQuery.matches) {
                // Reset sidebar on desktop
                this.sidebar.style.transform = '';
                this.sidebar.classList.remove('show');
            }
        });
    }

    startResizing(e) {
        this.isResizing = true;
        this.resizer.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }

    resize(e) {
        if (!this.isResizing) return;

        let clientX;
        if (e.type === 'touchmove') {
            clientX = e.touches[0].clientX;
        } else {
            clientX = e.clientX;
        }

        // Get minimum and maximum values from CSS variables
        const styles = getComputedStyle(document.documentElement);
        const minWidth = parseInt(styles.getPropertyValue('--sidebar-min-width'));
        const maxWidth = parseInt(styles.getPropertyValue('--sidebar-max-width'));

        // Calculate new width
        let newWidth = clientX;
        newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

        // Update sidebar width
        this.sidebar.style.width = newWidth + 'px';
        document.documentElement.style.setProperty('--sidebar-width', newWidth + 'px');

        this.lastSidebarWidth = newWidth;
        this.saveLayoutState();
    }

    stopResizing() {
        this.isResizing = false;
        this.resizer.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }

    toggleSidebar() {
        if (this.isSidebarCollapsed) {
            this.expandSidebar();
        } else {
            this.collapseSidebar();
        }
        this.saveLayoutState();
    }

    collapseSidebar() {
        this.sidebar.classList.add('collapsed');
        this.collapseButton.querySelector('i').className = 'fas fa-chevron-right';
        this.isSidebarCollapsed = true;
    }

    expandSidebar() {
        this.sidebar.classList.remove('collapsed');
        this.collapseButton.querySelector('i').className = 'fas fa-chevron-left';
        this.isSidebarCollapsed = false;
    }

    showSidebar() {
        this.sidebar.classList.add('show');
    }

    hideSidebar() {
        this.sidebar.classList.remove('show');
    }

    saveLayoutState() {
        const state = {
            sidebarWidth: this.lastSidebarWidth,
            isSidebarCollapsed: this.isSidebarCollapsed
        };
        localStorage.setItem('layoutState', JSON.stringify(state));
    }

    loadLayoutState() {
        const savedState = localStorage.getItem('layoutState');
        if (savedState) {
            const state = JSON.parse(savedState);
            
            // Apply saved width
            if (state.sidebarWidth) {
                this.sidebar.style.width = state.sidebarWidth + 'px';
                document.documentElement.style.setProperty('--sidebar-width', state.sidebarWidth + 'px');
                this.lastSidebarWidth = state.sidebarWidth;
            }

            // Apply saved collapse state
            if (state.isSidebarCollapsed) {
                this.collapseSidebar();
            }
        }
    }
}

// Initialize layout manager
const layoutManager = new LayoutManager();