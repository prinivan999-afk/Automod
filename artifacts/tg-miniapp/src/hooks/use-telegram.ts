import { useState, useEffect } from "react";

export function useTelegramWebApp() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // @ts-ignore
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      
      // Apply theme
      if (tg.colorScheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }

      // Read theme params
      const themeParams = tg.themeParams;
      if (themeParams) {
        const root = document.documentElement;
        if (themeParams.bg_color) root.style.setProperty("--tg-theme-bg-color", themeParams.bg_color);
        if (themeParams.text_color) root.style.setProperty("--tg-theme-text-color", themeParams.text_color);
        if (themeParams.hint_color) root.style.setProperty("--tg-theme-hint-color", themeParams.hint_color);
        if (themeParams.link_color) root.style.setProperty("--tg-theme-link-color", themeParams.link_color);
        if (themeParams.button_color) root.style.setProperty("--tg-theme-button-color", themeParams.button_color);
        if (themeParams.button_text_color) root.style.setProperty("--tg-theme-button-text-color", themeParams.button_text_color);
        if (themeParams.secondary_bg_color) root.style.setProperty("--tg-theme-secondary-bg-color", themeParams.secondary_bg_color);
        if (themeParams.header_bg_color) root.style.setProperty("--tg-theme-header-bg-color", themeParams.header_bg_color);
        if (themeParams.accent_text_color) root.style.setProperty("--tg-theme-accent-text-color", themeParams.accent_text_color);
        if (themeParams.section_bg_color) root.style.setProperty("--tg-theme-section-bg-color", themeParams.section_bg_color);
        if (themeParams.section_header_text_color) root.style.setProperty("--tg-theme-section-header-text-color", themeParams.section_header_text_color);
        if (themeParams.subtitle_text_color) root.style.setProperty("--tg-theme-subtitle-text-color", themeParams.subtitle_text_color);
        if (themeParams.destructive_text_color) root.style.setProperty("--tg-theme-destructive-text-color", themeParams.destructive_text_color);
      }

      setIsReady(true);
    } else {
      // Not in Telegram WebApp
      setIsReady(true);
    }
  }, []);

  return { isReady };
}
