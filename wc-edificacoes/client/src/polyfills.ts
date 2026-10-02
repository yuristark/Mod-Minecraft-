/**
 * Complementos mínimos para celulares mais antigos (iOS 14/15, Android com Chrome < 93).
 * A sintaxe já é convertida no build (vite.config.ts → build.target); aqui entram só
 * métodos que algumas bibliotecas chamam e que esses navegadores não têm.
 * Importado antes de tudo em main.tsx.
 */
/* eslint-disable no-extend-native */
function at<T>(this: ArrayLike<T>, n: number): T | undefined {
  const i = Math.trunc(n) || 0;
  const k = i < 0 ? this.length + i : i;
  return k < 0 || k >= this.length ? undefined : this[k];
}
for (const proto of [Array.prototype, String.prototype, Object.getPrototypeOf(Int8Array.prototype)]) {
  if (!("at" in proto)) Object.defineProperty(proto, "at", { value: at, writable: true, configurable: true });
}
if (!Object.hasOwn) {
  Object.defineProperty(Object, "hasOwn", {
    value: (obj: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(obj, key),
    writable: true,
    configurable: true,
  });
}
if (typeof window !== "undefined" && !("queueMicrotask" in window)) {
  (window as Window).queueMicrotask = (cb: () => void) => { void Promise.resolve().then(cb); };
}
export {};
