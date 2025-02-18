// Mobile menu functionality
export function initializeMobileMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    if (!menuToggle) return;
    const menuDropdown = document.getElementById('menu-dropdown');
    
    // Toggle menu
    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        menuDropdown.classList.toggle('show');
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!menuDropdown.contains(e.target) && !menuToggle.contains(e.target)) {
            menuDropdown.classList.remove('show');
        }
    });
    
    // Mobile menu items
    const mobileItems = {
        'export-button-mobile': 'export-button',
        'reset-button-mobile': 'reset-button',
        'expert-mode-toggle-mobile': 'expert-mode-toggle'
    };
    
    // Add click handlers to mobile menu items
    Object.entries(mobileItems).forEach(([mobileId, desktopId]) => {
        const mobileButton = document.querySelector(`.${mobileId}`);
        const desktopButton = document.getElementById(desktopId);
        
        if (mobileButton && desktopButton) {
            mobileButton.addEventListener('click', () => {
                // Trigger click on corresponding desktop button
                desktopButton.click();
                // Close mobile menu
                menuDropdown.classList.remove('show');
            });
        }
    });
}