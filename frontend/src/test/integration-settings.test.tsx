import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import type { User } from "@/contexts/AuthContext";
import { IntegrationManagementSection } from "@/components/settings/IntegrationManagementSection";
import { IntegrationSecretDialog } from "@/components/settings/integrations/IntegrationSecretDialog";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  rotate: vi.fn(),
  revoke: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/api/contract", () => ({
  integrationsApi: {
    integrationManagementControllerList: api.list,
    integrationManagementControllerCreate: api.create,
    integrationManagementControllerRotate: api.rotate,
    integrationManagementControllerRevoke: api.revoke,
    integrationManagementControllerRemove: api.remove,
  },
}));
vi.mock("@/hooks/useCategories", () => ({
  useCategories: (_workspace: string, _archived: boolean, type: string) => ({
    categories:
      type === "expense"
        ? [
            {
              id: "cat-1",
              name: "Food",
              systemKey: null,
              icon: null,
              children: [],
            },
          ]
        : [],
    isLoading: false,
    error: null,
    retry: vi.fn(),
  }),
}));
vi.mock("@/hooks/usePaymentSources", () => ({
  usePaymentSources: () => ({
    paymentSources: [{ id: "source-1", name: "Bank", systemKey: null }],
    isLoading: false,
    error: null,
    retry: vi.fn(),
  }),
}));

const user: User = {
  id: "user-1",
  name: "Ada",
  email: "ada@example.com",
  emailVerified: true,
  totpEnabled: false,
  hideSalaryAmounts: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};
const issued = {
  token: "mqic_fixture_secret_for_settings_tests_only",
  token_prefix: "mqic_fixture",
  expires_at: "2099-01-01T00:00:00Z",
};
function integration() {
  return {
    id: "integration-1",
    name: "expense-importer",
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    created_by: { id: user.id, name: user.name },
    credentials: [
      {
        id: "credential-1",
        token_prefix: "mqic_original",
        status: "active",
        created_at: "2026-01-01T00:00:00Z",
        expires_at: "2099-01-01T00:00:00Z",
        revoked_at: null as string | null,
        last_used_at: null,
        scopes: ["transactions:create"],
        category_allowlist_enabled: true,
        category_ids: ["cat-1"],
        payment_source_allowlist_enabled: true,
        payment_source_ids: ["source-1"],
        cidr_allowlist_enabled: true,
        allowed_cidrs: ["203.0.113.0/24"],
      },
    ],
  };
}
const saved = vi.fn();
function view(
  workspaceId = "ws-1",
  role: "owner" | "admin" | "member" | undefined = "owner",
  identity: User | null = user,
) {
  return (
    <IntegrationManagementSection
      workspaceId={workspaceId}
      role={role}
      user={identity}
      onSaved={saved}
    />
  );
}
async function openCreate(input: ReturnType<typeof userEvent.setup>) {
  const button = await screen.findByRole("button", { name: "Add integration" });
  await waitFor(() => expect(button).toBeEnabled());
  await input.click(button);
  await input.type(
    screen.getByLabelText("Integration name"),
    "expense-importer",
  );
  await input.click(screen.getByRole("button", { name: "Next" }));
}
async function confirmStep(input: ReturnType<typeof userEvent.setup>) {
  for (let count = 0; count < 4; count++)
    await input.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByLabelText("Current password")).toBeInTheDocument();
}
async function create(input: ReturnType<typeof userEvent.setup>) {
  await openCreate(input);
  await confirmStep(input);
  await input.type(
    screen.getByLabelText("Current password"),
    "synthetic-password",
  );
  await input.click(screen.getByRole("button", { name: "Create key" }));
}

beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage("en");
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  api.list.mockResolvedValue({ data: [] });
  api.create.mockResolvedValue({ data: issued });
  api.rotate.mockResolvedValue({ data: issued });
  api.revoke.mockResolvedValue({ data: { revoked: true } });
  api.remove.mockResolvedValue({ data: { deleted: true } });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("integration settings permissions and secret lifetime", () => {
  it("shows name and expiry errors only at the affected field", async () => {
    const input = userEvent.setup();
    render(view());
    await input.click(
      await screen.findByRole("button", { name: "Add integration" }),
    );
    await input.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Enter an integration name.")).toBeInTheDocument();
    expect(screen.getByLabelText("Integration name")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("Valid until")).not.toHaveAttribute(
      "aria-invalid",
    );
    await input.type(screen.getByLabelText("Integration name"), "Importer");
    expect(
      screen.queryByText("Enter an integration name."),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Valid until"), {
      target: { value: "" },
    });
    await input.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("Valid until")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("Integration name")).not.toHaveAttribute(
      "aria-invalid",
    );
  });
  it("searches resource names without exposing IDs or carrying a category search into sources", async () => {
    const input = userEvent.setup();
    render(view());
    await openCreate(input);
    await input.click(screen.getByRole("button", { name: "Next" }));
    await input.click(
      screen.getByRole("radio", { name: "Only selected resources" }),
    );
    await input.type(screen.getByLabelText("Search by name"), "food");
    await input.click(screen.getByRole("checkbox", { name: "Food" }));
    expect(screen.queryByText("cat-1")).not.toBeInTheDocument();
    expect(screen.getByText("Selected: 1")).toBeInTheDocument();
    await input.click(screen.getByRole("button", { name: "Next" }));
    await input.click(
      screen.getByRole("radio", { name: "Only selected resources" }),
    );
    expect(screen.getByLabelText("Search by name")).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: "Bank" })).toBeInTheDocument();
    expect(screen.queryByText("source-1")).not.toBeInTheDocument();
  });
  it.each(["member", undefined] as const)(
    "does not fetch credentials for role %s",
    (role) => {
      render(
        <IntegrationManagementSection
          workspaceId="ws-1"
          role={role}
          user={user}
          onSaved={saved}
        />,
      );
      expect(api.list).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("button", { name: "Add integration" }),
      ).not.toBeInTheDocument();
    },
  );
  it("does not fetch for a missing human identity", () => {
    render(view("ws-1", "owner", null));
    expect(api.list).not.toHaveBeenCalled();
  });
  it("defaults to no scopes, reveals only after issuance, and drops the secret on dismissal", async () => {
    const input = userEvent.setup();
    render(view());
    await openCreate(input);
    expect(screen.getAllByRole("checkbox")).toHaveLength(6);
    for (const checkbox of screen.getAllByRole("checkbox"))
      expect(checkbox).not.toBeChecked();
    await confirmStep(input);
    await input.type(
      screen.getByLabelText("Current password"),
      "synthetic-password",
    );
    await input.click(screen.getByRole("button", { name: "Create key" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Save your integration key",
    });
    // A success toast would cover the one-time controls on narrow viewports.
    expect(saved).not.toHaveBeenCalled();
    expect(api.create.mock.calls[0]?.[1]).toMatchObject({
      scopes: [],
      category_allowlist_enabled: false,
      payment_source_allowlist_enabled: false,
      allowed_cidrs: [],
    });
    expect(api.create.mock.calls[0]?.[2]).toMatchObject({ timeout: 30_000 });
    expect(dialog).not.toHaveTextContent(issued.token);
    await input.click(within(dialog).getByRole("button", { name: "Show key" }));
    expect(dialog).toHaveTextContent(issued.token);
    expect(JSON.stringify(localStorage)).not.toContain(issued.token);
    expect(JSON.stringify(sessionStorage)).not.toContain(issued.token);
    await input.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText(issued.token)).not.toBeInTheDocument();
    await input.click(screen.getByRole("button", { name: "Add integration" }));
    expect(screen.queryByText(issued.token)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Integration name")).toHaveValue("");
  });
  it("aborts issuance and ignores a late secret when the workspace changes", async () => {
    const input = userEvent.setup();
    let resolve!: (value: { data: typeof issued }) => void;
    api.create.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const rendered = render(view());
    await create(input);
    expect(api.create).toHaveBeenCalledTimes(1);
    const signal = api.create.mock.calls[0]?.[2].signal as AbortSignal;
    rendered.rerender(view("ws-2"));
    expect(signal.aborted).toBe(true);
    await act(async () => resolve({ data: issued }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(issued.token)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(api.list).toHaveBeenCalledWith("ws-2", expect.any(Object)),
    );
  });
  it("drops an issued secret immediately on loss of the owner/admin role", async () => {
    const input = userEvent.setup();
    const rendered = render(view());
    await create(input);
    await screen.findByRole("dialog", { name: "Save your integration key" });
    rendered.rerender(view("ws-1", "member"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(issued.token)).not.toBeInTheDocument();
  });
  it("keeps a committed one-time response when the following metadata refresh fails", async () => {
    const input = userEvent.setup();
    api.list
      .mockResolvedValueOnce({ data: [] })
      .mockRejectedValue({ response: { status: 503 } });
    render(view());
    await create(input);
    await screen.findByRole("dialog", { name: "Save your integration key" });
    await input.click(screen.getByRole("button", { name: "Show key" }));
    expect(screen.getByText(issued.token)).toBeInTheDocument();
    expect(api.create).toHaveBeenCalledTimes(1);
  });
  it("clears password inputs and does not reveal a secret on step-up failure", async () => {
    const input = userEvent.setup();
    api.create.mockRejectedValue({
      response: { status: 401, data: { token: issued.token } },
    });
    render(view());
    await create(input);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not be verified",
    );
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.queryByText(issued.token)).not.toBeInTheDocument();
  });
  it("rejects an impossible CIDR before issuing a key", async () => {
    const input = userEvent.setup();
    render(view());
    await openCreate(input);
    for (let count = 0; count < 3; count++)
      await input.click(screen.getByRole("button", { name: "Next" }));
    await input.click(screen.getByLabelText("Restrict requests to IP ranges"));
    fireEvent.change(screen.getByLabelText("Allowed CIDRs, one per line"), {
      target: { value: "999.2.3.4/99" },
    });
    await input.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toHaveTextContent("valid IPv4 or IPv6");
    expect(api.create).not.toHaveBeenCalled();
  });
});

describe("credential lifecycle and safe inspection", () => {
  it("keeps explicitly enabled empty allowlists restrictive", async () => {
    const input = userEvent.setup();
    render(view());
    await openCreate(input);
    await input.click(screen.getByRole("button", { name: "Next" }));
    await input.click(screen.getByLabelText("Only selected resources"));
    expect(
      screen.getByText(/enabled empty list blocks access/),
    ).toBeInTheDocument();
    await input.click(screen.getByRole("button", { name: "Next" }));
    await input.click(screen.getByLabelText("Only selected resources"));
    await input.click(screen.getByRole("button", { name: "Next" }));
    await input.click(screen.getByLabelText("Restrict requests to IP ranges"));
    await input.click(screen.getByRole("button", { name: "Next" }));
    await input.type(
      screen.getByLabelText("Current password"),
      "synthetic-password",
    );
    await input.click(screen.getByRole("button", { name: "Create key" }));
    await screen.findByRole("dialog", { name: "Save your integration key" });
    expect(api.create.mock.calls[0]?.[1]).toMatchObject({
      category_allowlist_enabled: true,
      category_ids: [],
      payment_source_allowlist_enabled: true,
      payment_source_ids: [],
      cidr_allowlist_enabled: true,
      allowed_cidrs: [],
    });
  });
  it("shows safe history, policy and last-use metadata without a full token", async () => {
    const input = userEvent.setup();
    api.list.mockResolvedValue({ data: [integration()] });
    render(view("ws-1", "admin"));
    await input.click(
      await screen.findByRole("button", { name: "View details" }),
    );
    const dialog = screen.getByRole("dialog", { name: "expense-importer" });
    expect(dialog).toHaveTextContent("Key version history");
    expect(dialog).toHaveTextContent("Not used yet");
    expect(dialog).toHaveTextContent("Food");
    expect(dialog).not.toHaveTextContent("cat-1");
    expect(dialog).toHaveTextContent("203.0.113.0/24");
    expect(dialog).not.toHaveTextContent(issued.token);
  });
  it("rotates with an explicit reviewed policy under the same integration identity", async () => {
    const input = userEvent.setup();
    api.list.mockResolvedValue({ data: [integration()] });
    render(view());
    await input.click(
      await screen.findByRole("button", { name: "Replace key" }),
    );
    expect(
      screen.getByText(/Replacing the key immediately revokes/),
    ).toBeInTheDocument();
    await input.click(screen.getByRole("button", { name: "Next" }));
    await input.click(
      screen.getByRole("checkbox", { name: /^Create transactions/ }),
    );
    await input.click(
      screen.getByRole("checkbox", { name: /^Update its transactions/ }),
    );
    await confirmStep(input);
    await input.type(
      screen.getByLabelText("Current password"),
      "synthetic-password",
    );
    await input.click(screen.getByRole("button", { name: "Replace key" }));
    await screen.findByRole("dialog", { name: "Save your integration key" });
    expect(api.rotate).toHaveBeenCalledWith(
      "integration-1",
      "credential-1",
      "ws-1",
      expect.objectContaining({
        scopes: ["transactions:update-own"],
        category_allowlist_enabled: true,
        category_ids: ["cat-1"],
        payment_source_ids: ["source-1"],
        allowed_cidrs: ["203.0.113.0/24"],
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(api.rotate.mock.calls[0]?.[3]).not.toHaveProperty("name");
  });
  it("requires confirmation and the second factor before revoking", async () => {
    const input = userEvent.setup();
    api.list.mockResolvedValue({ data: [integration()] });
    render(view("ws-1", "owner", { ...user, totpEnabled: true }));
    await input.click(await screen.findByRole("button", { name: "Revoke" }));
    await input.click(screen.getByRole("button", { name: "Cancel" }));
    expect(api.revoke).not.toHaveBeenCalled();
    await input.click(screen.getByRole("button", { name: "Revoke" }));
    await input.type(
      screen.getByLabelText("Current password"),
      "synthetic-password",
    );
    await input.click(screen.getByRole("button", { name: "Revoke key" }));
    expect(api.revoke).not.toHaveBeenCalled();
    await input.type(
      screen.getByLabelText("Two-factor or recovery code"),
      "123456",
    );
    await input.click(screen.getByRole("button", { name: "Revoke key" }));
    await waitFor(() => expect(api.revoke).toHaveBeenCalledTimes(1));
    expect(api.revoke.mock.calls[0]?.[3]).toEqual({
      current_password: "synthetic-password",
      two_factor_token: "123456",
    });
  });
  it("allows revoking an expired key but not rotating it, and only deletes revoked versions", async () => {
    const input = userEvent.setup();
    const item = integration();
    item.credentials[0]!.expires_at = "2020-01-01T00:00:00Z";
    api.list.mockResolvedValue({ data: [item] });
    const rendered = render(view());
    await screen.findByText("Expired");
    expect(
      screen.queryByRole("button", { name: "Replace key" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument();
    item.credentials[0]!.status = "revoked";
    item.credentials[0]!.revoked_at = "2026-01-02T00:00:00Z";
    rendered.rerender(view("ws-2"));
    await input.click(await screen.findByRole("button", { name: "Delete" }));
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
    await input.click(screen.getByRole("button", { name: "Delete key" }));
    await waitFor(() =>
      expect(api.remove).toHaveBeenCalledWith(
        "integration-1",
        "credential-1",
        "ws-2",
        expect.any(Object),
      ),
    );
  });
});

describe("one-time secret dialog", () => {
  it("closes after five minutes and on backgrounding", () => {
    vi.useFakeTimers();
    const close = vi.fn();
    render(
      <IntegrationSecretDialog
        secret={{
          token: issued.token,
          tokenPrefix: issued.token_prefix,
          expiresAt: issued.expires_at,
        }}
        onClose={close}
      />,
    );
    act(() => vi.advanceTimersByTime(5 * 60_000));
    expect(close).toHaveBeenCalledTimes(1);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(close).toHaveBeenCalledTimes(2);
  });
  it("handles a denied clipboard without logging or persisting the key", async () => {
    const input = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("clipboard denied"),
    );
    render(
      <IntegrationSecretDialog
        secret={{
          token: issued.token,
          tokenPrefix: issued.token_prefix,
          expiresAt: issued.expires_at,
        }}
        onClose={vi.fn()}
      />,
    );
    await input.click(screen.getByRole("button", { name: "Copy key" }));
    expect(
      await screen.findByText(/Clipboard access failed/),
    ).toBeInTheDocument();
    expect(screen.queryByText(issued.token)).not.toBeInTheDocument();
  });
});
