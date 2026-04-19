@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
@import "tailwindcss";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;

  --color-cafe-bg: #0D0D0D;
  --color-cafe-surface: #1A1A1A;
  --color-cafe-border: #2D2D2D;
  --color-cafe-accent: #D4A373;
  --color-cafe-text: #E0E0E0;
  --color-cafe-text-dim: #888888;
  --color-cafe-success: #81B29A;
  --color-cafe-danger: #E07A5F;
}

body {
  background-color: var(--color-cafe-bg);
  color: var(--color-cafe-text);
  margin: 0;
}

@media print {
  @page {
    margin: 1cm;
  }
  
  body {
    background-color: white !important;
    color: black !important;
  }

  .no-print {
    display: none !important;
  }

  /* Make sure background colors in report elements show up if printer supports it, 
     or swap them for white/borders for better visibility on paper */
  .bg-cafe-surface {
    background-color: white !important;
    border: 1px solid #ddd !important;
  }

  .text-cafe-text, .text-cafe-text-dim, .text-cafe-accent {
    color: black !important;
  }

  .printable-content {
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    display: block !important;
  }
}

