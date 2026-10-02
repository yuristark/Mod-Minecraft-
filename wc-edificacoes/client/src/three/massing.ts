import type { Category, Standard } from "@/lib/types";

/**
 * Volumetria aproximada da obra a partir do tipo, padrão e área.
 * Arquivo sem three.js: o React usa para as legendas sem baixar a biblioteca 3D.
 */
export interface Massing {
  floors: number;
  width: number;
  depth: number;
  floorH: number;
  height: number;
}

export function massing(category: Category, standard: Standard, area: number): Massing {
  const a = Math.min(Math.max(area || 0, 20), 100_000);
  let floors = 1;
  let floorH = 3;
  let ratio = 1.4;
  switch (category) {
    case "residencial":
      floors = a > 240 || (standard === "alto" && a > 160) ? 2 : 1;
      if (a > 900) floors = 3;
      break;
    case "comercial":
      floors = Math.min(14, Math.max(1, Math.ceil(a / 420)));
      floorH = 3.4;
      ratio = 1.6;
      break;
    case "industrial":
      floors = 1;
      floorH = standard === "alto" ? 11 : standard === "medio" ? 9 : 7.5;
      ratio = 2;
      break;
    case "reforma":
      floors = Math.min(6, Math.max(1, Math.ceil(a / 260)));
      floorH = 3;
      ratio = 1.3;
      break;
  }
  const fp = a / floors;
  const width = Math.sqrt(fp * ratio);
  const depth = fp / width;
  return { floors, width, depth, floorH, height: floors * floorH };
}
