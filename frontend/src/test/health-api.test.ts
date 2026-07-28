import { describe, it, expect, vi } from "vitest";
import { HealthApi } from "@/api/client/api/health-api";

describe("HealthApi (generated client)", () => {
  it("should call GET /health with correct config", async () => {
    // Mock axios instance
    const mockAxios = {
      request: vi.fn().mockResolvedValue({ data: { status: "OK" } }),
    };

    // Create API instance with mocked axios
    // @ts-expect-error Testing with mocked axios
    const api = new HealthApi(undefined, "/api/v1", mockAxios);

    // Call the method
    const response = await api.healthControllerCheckHealth();

    // Expect axios.request to have been called
    expect(mockAxios.request).toHaveBeenCalledTimes(1);
    const callArg = mockAxios.request.mock.calls[0][0];
    expect(callArg.method).toBe("GET");
    // Base URL is likely '/api/v1' + '/health' = '/api/v1/health'
    expect(callArg.url).toBe("/api/v1/health");
    // Optionally check headers
    // (Removed Accept header check because the new generator version doesn't set it automatically)
    // Ensure we got the mocked data back
    expect(response.data).toEqual({ status: "OK" });
  });
});
