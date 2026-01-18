// Theme toggle functionality
(function() {
  function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    const logo = document.getElementById('logo');
    
    if (!themeToggle || !logo) {
      // Retry if elements not ready
      setTimeout(initTheme, 10);
      return;
    }
    
    // Load saved theme or default to dark
    const savedTheme = localStorage.getItem('prompt-easy-theme') || 'dark';
    body.classList.remove('dark', 'light');
    body.classList.add(savedTheme);
    
    function updateTheme(theme) {
      if (theme === 'dark') {
        themeToggle.textContent = '☀';
        // Invert logo for dark mode (makes dark logo visible on dark bg)
        logo.style.filter = 'invert(1) brightness(1.2)';
      } else {
        themeToggle.textContent = '🌙';
        // Reset filter for light mode
        logo.style.filter = 'none';
      }
    }
    
    // Initialize theme on load
    updateTheme(savedTheme);
    
    // Add click handler
    themeToggle.addEventListener('click', () => {
      const isDark = body.classList.contains('dark');
      const newTheme = isDark ? 'light' : 'dark';
      body.classList.remove('dark', 'light');
      body.classList.add(newTheme);
      localStorage.setItem('prompt-easy-theme', newTheme);
      updateTheme(newTheme);
    });
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
  } else {
    initTheme();
  }
})();
