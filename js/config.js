/**
 * Dark Watch - Global Application Configuration
 * Centralized toggles and environment settings.
 */

export const APP_CONFIG = {
  // Flag to temporarily disable the Anime section across the entire public platform.
  // When false:
  // - Anime is hidden from Homepage, Header navigation, and Footer.
  // - Anime routes and search results are filtered out for public visitors.
  // - Anime database records and episodes remain 100% safe and intact in PostgreSQL.
  // - Setting to true instantly reactivates the Anime section seamlessly.
  ANIME_ENABLED: false,

  // Application Metadata
  APP_NAME: 'Dark Watch',
  APP_VERSION: '2.5.0'
};

// Expose globally for convenience and fast inspection
if (typeof window !== 'undefined') {
  window.APP_CONFIG = APP_CONFIG;
  window.ANIME_ENABLED = APP_CONFIG.ANIME_ENABLED;
}
