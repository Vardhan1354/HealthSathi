/**
 * API Configuration for HealthSathi
 * 
 * In development: Uses Vite proxy (relative paths like /api/xxx)
 * In production: Uses AWS API Gateway endpoint
 */

// API Gateway endpoint (set during production build)
const API_GATEWAY_URL = "https://utri9ho4rg.execute-api.ap-south-1.amazonaws.com/prod";

/**
 * Get the base URL for API calls.
 * Returns empty string for development (uses Vite proxy with relative paths).
 * Returns API Gateway URL for production (CloudFront deployment).
 */
export function getApiBaseUrl(): string {
  // If running on localhost or via Vite dev server (has proxy), use relative paths
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host.startsWith("192.168.")) {
      return ""; // Use Vite proxy (relative /api/xxx paths)
    }
  }
  
  // Production (CloudFront) - use API Gateway
  return API_GATEWAY_URL;
}

/**
 * Build a full API URL for the given path.
 * @param path - API path like "/api/translate"
 */
export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : "/" + path;
  return base + normalizedPath;
}
