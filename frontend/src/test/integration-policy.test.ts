import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cidrLines,
  defaultExpiry,
  expiryEndOfDay,
  localDateTime,
  maxExpiry,
  validCidr,
  validExpiry,
} from "@/components/settings/integrations/credential-policy";

afterEach(() => vi.useRealTimers());

describe("credential network policy", () => {
  it.each([
    "0.0.0.0/0",
    "203.0.113.7/32",
    "203.0.113.0/24",
    "::/0",
    "::1/128",
    "2001:db8::/32",
    "::ffff:192.0.2.1/128",
  ])("accepts valid CIDR %s", (value) => expect(validCidr(value)).toBe(true));
  it.each([
    "203.0.113.1",
    "203.0.113.1/33",
    "999.2.3.4/24",
    "01.2.3.4/24",
    "1.2.3/24",
    "1.2.3.4/-1",
    "1.2.3.4/01",
    "2001:::1/64",
    "::1/129",
    "::gg/64",
    "fe80::1%eth0/64",
    "2001:db8:1:2:3:4:5:6:7/64",
    "::ffff:999.1.1.1/120",
    "[::1]/128",
    "1.2.3.4/24/5",
    "::1/",
    "::1/ 64",
  ])("rejects malformed CIDR %s", (value) =>
    expect(validCidr(value)).toBe(false),
  );
  it("trims lines and deduplicates without broadening an enabled empty policy", () => {
    expect(cidrLines(" 203.0.113.0/24\r\n\n203.0.113.0/24\n::1/128 ")).toEqual([
      "203.0.113.0/24",
      "::1/128",
    ]);
    expect(cidrLines("\n \r\n")).toEqual([]);
  });
});

describe("credential expiry", () => {
  it("expires at the end of the selected local day and rejects invalid calendar dates", () => {
    const expiry = expiryEndOfDay("2026-10-25");
    expect(expiry.getFullYear()).toBe(2026);
    expect(expiry.getMonth()).toBe(9);
    expect(expiry.getDate()).toBe(25);
    expect([
      expiry.getHours(),
      expiry.getMinutes(),
      expiry.getSeconds(),
      expiry.getMilliseconds(),
    ]).toEqual([23, 59, 59, 999]);
    expect(Number.isNaN(expiryEndOfDay("2026-02-30").getTime())).toBe(true);
    expect(Number.isNaN(expiryEndOfDay("").getTime())).toBe(true);
  });
  it("bounds the actual instant rather than the end of a calendar day", () => {
    vi.useFakeTimers();
    const now = new Date("2026-09-04T12:30:45.000Z");
    vi.setSystemTime(now);
    expect(validExpiry(now.toISOString())).toBe(false);
    expect(validExpiry("invalid")).toBe(false);
    expect(
      validExpiry(new Date(now.getTime() + 365 * 86_400_000).toISOString()),
    ).toBe(true);
    expect(
      validExpiry(new Date(now.getTime() + 365 * 86_400_000 + 1).toISOString()),
    ).toBe(false);
    expect(validExpiry(defaultExpiry())).toBe(true);
    expect(validExpiry(maxExpiry())).toBe(true);
    expect(localDateTime(now)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
