declare module '@folder/xdg' {
  interface XdgDirs {
    cache: string;
    config: string;
    configdirs: string[];
    data: string;
    datadirs: string[];
    runtime?: string;
  }

  function xdg(options?: Record<string, unknown>): XdgDirs;
  export default xdg;
}
