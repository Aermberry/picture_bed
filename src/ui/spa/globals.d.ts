export {};

declare global {
  interface Window {
    __PICBED_UI_DEV__?: boolean;
    picbedNative?: { getPathForFile: (file: File) => string };
  }
  interface File {
    path?: string;
  }
}
