/**
 * Route paths are relative to next.config.ts's `basePath`, so they carry no
 * `/react-vello` prefix. Use `absoluteUrl` wherever a full URL is required
 * (metadata, canonicals, the sitemap).
 */
export const SITE_ORIGIN = "https://blode.co";
export const BASE_PATH = "/react-vello";

export const DEMO_PATH = "/";
export const STRESS_TEST_REACT_VELLO_PATH = "/stress-test-react-vello";
export const STRESS_TEST_REACT_KONVA_PATH = "/stress-test-react-konva";
export const STRESS_TEST_REACT_DOM_PATH = "/stress-test-react-dom";

export const ROUTES = [
  DEMO_PATH,
  STRESS_TEST_REACT_VELLO_PATH,
  STRESS_TEST_REACT_KONVA_PATH,
  STRESS_TEST_REACT_DOM_PATH,
] as const;

export function absoluteUrl(path: string): string {
  return path === DEMO_PATH
    ? `${SITE_ORIGIN}${BASE_PATH}`
    : `${SITE_ORIGIN}${BASE_PATH}${path}`;
}
