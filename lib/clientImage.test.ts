import { describe, expect, it } from "vitest";
import { fitWithin, isHeic } from "./clientImage";

describe("client image resize", () => {
  it("shrinks the longest side to the maximum and keeps the ratio", () => {
    expect(fitWithin(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3000, 4000, 2000)).toEqual({ width: 1500, height: 2000 });
  });
  it("never scales up", () => {
    expect(fitWithin(900, 1200, 2000)).toEqual({ width: 900, height: 1200 });
    expect(fitWithin(2000, 2000, 2000)).toEqual({ width: 2000, height: 2000 });
  });
  it("never returns a zero side", () => {
    expect(fitWithin(10000, 1, 2000).height).toBeGreaterThanOrEqual(1);
  });
  it("recognises HEIC by type or by file name", () => {
    expect(isHeic({ type: "image/heic" } as Blob)).toBe(true);
    expect(isHeic({ type: "", name: "IMG_0001.HEIC" } as Blob & { name: string })).toBe(true);
    expect(isHeic({ type: "image/jpeg", name: "a.jpg" } as Blob & { name: string })).toBe(false);
  });
});
