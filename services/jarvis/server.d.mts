import type { RequestListener, Server } from "node:http";

export interface JarvisOptions {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  checkBridgeHealth?: boolean;
}

export function createJarvisApp(options?: JarvisOptions): RequestListener & {
  listen(port: number, host: string, callback?: () => void): Server;
};

export function startJarvisServer(options?: JarvisOptions): Server;
