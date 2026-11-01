import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, clientIp, resetRateLimits } from "./rateLimit";

const HOUR = 3_600_000;

describe("rate limit: 10 requests per hour per IP", () => {
  beforeEach(() => resetRateLimits());

  it("allows 10, blocks the 11th", () => {
    for (let i = 0; i < 10; i++) expect(checkRateLimit("ip1", 10, HOUR, 1_000 + i).allowed).toBe(true);
    const r = checkRateLimit("ip1", 10, HOUR, 2_000);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSec).toBeGreaterThan(0);
  });

  it("counts each IP separately", () => {
    for (let i = 0; i < 10; i++) checkRateLimit("ip1", 10, HOUR, 1_000);
    expect(checkRateLimit("ip1", 10, HOUR, 1_000).allowed).toBe(false);
    expect(checkRateLimit("ip2", 10, HOUR, 1_000).allowed).toBe(true);
  });

  it("lets requests through again after the window passes", () => {
    for (let i = 0; i < 10; i++) checkRateLimit("ip1", 10, HOUR, 1_000);
    expect(checkRateLimit("ip1", 10, HOUR, 1_000 + HOUR - 1).allowed).toBe(false);
    expect(checkRateLimit("ip1", 10, HOUR, 1_000 + HOUR + 1).allowed).toBe(true);
  });

  it("blocked requests do not extend the block", () => {
    for (let i = 0; i < 10; i++) checkRateLimit("ip1", 10, HOUR, 1_000);
    for (let i = 0; i < 50; i++) checkRateLimit("ip1", 10, HOUR, 2_000);
    expect(checkRateLimit("ip1", 10, HOUR, 1_000 + HOUR + 1).allowed).toBe(true);
  });

  it("reads the client IP from proxy headers", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
