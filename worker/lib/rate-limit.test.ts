import { beforeEach, describe, expect, it } from "vitest";
import { hit, resetRateLimits } from "./rate-limit";

describe("rate limit", () => {
  beforeEach(resetRateLimits);
  const rule = { name: "t", limit: 3, windowMs: 1000 };
  it("limite kadar izin verir, sonra reddeder", () => {
    expect([hit(rule, "a", 0), hit(rule, "a", 0), hit(rule, "a", 0)]).toEqual([null, null, null]);
    expect(hit(rule, "a", 100)).toBe(1);
  });
  it("istemciler birbirinden bağımsızdır", () => {
    for (let i = 0; i < 4; i++) hit(rule, "a", 0);
    expect(hit(rule, "b", 0)).toBeNull();
  });
  it("pencere dolunca sıfırlanır", () => {
    for (let i = 0; i < 4; i++) hit(rule, "a", 0);
    expect(hit(rule, "a", 1000)).toBeNull();
  });
});
