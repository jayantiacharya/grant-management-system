import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { mockUseAuth, mockNavigate, mockLogout } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockNavigate: vi.fn(),
  mockLogout: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null }),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("axios", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import axios from "axios";
import AllocationPage from "./AllocationPage";

const chairUser = { id: "c1", email: "chair@wsu.edu", role: "arcc-chair" };

// Matches the DEFAULT_CRITERIA shape used by the component.
const defaultCriteria = [
  { fromPercentage: 90, toPercentage: 100, awardPercentage: 100 },
  { fromPercentage: 80, toPercentage: 89.99, awardPercentage: 75 },
  { fromPercentage: 75, toPercentage: 79.99, awardPercentage: 50 },
];

function apiGrant(overrides = {}) {
  return {
    id: "g1",
    title: "Test Grant",
    submittedBy: "proposer@wsu.edu",
    principalInvestigator: "Dr. PI",
    accountNumber: "ACC-001",
    arccAmountRequested: 0,
    otherSourcesAmount: 0,
    finalPercent: 0,
    allocatedAmount: 0,
    status: "Pending Review",
    reviewCount: 1,
    ...overrides,
  };
}

function mockGrantsResponse(overrides: Record<string, unknown> = {}) {
  vi.mocked(axios.get).mockResolvedValue({
    data: {
      grants: [],
      currentCycleAmount: 50000,
      cutoffPercentage: 75,
      criteria: defaultCriteria,
      finalized: false,
      ...overrides,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: chairUser,
    token: "tok123",
    logout: mockLogout,
  });
  mockGrantsResponse();
  vi.mocked(axios.post).mockResolvedValue({ data: { message: "ok" } });
});

describe("AllocationPage", () => {
  it("fetches allocation grants on mount using the auth token", async () => {
    render(<AllocationPage />);

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        "http://localhost:5000/api/allocation/grants",
        expect.objectContaining({
          headers: { Authorization: "Bearer tok123" },
        }),
      );
    });
  });

  it("shows an over-budget warning when total allocated exceeds the current cycle amount", async () => {
    // Available = $10,000. Two grants at 100% award, $8,000 each = $16,000
    // allocated, which exceeds the $10,000 available.
    mockGrantsResponse({
      currentCycleAmount: 10000,
      grants: [
        apiGrant({ id: "g1", arccAmountRequested: 8000, finalPercent: 95 }),
        apiGrant({ id: "g2", arccAmountRequested: 8000, finalPercent: 95 }),
      ],
    });

    render(<AllocationPage />);

    expect(
      await screen.findByText(/you are allocating more money than available/i),
    ).toBeInTheDocument();
  });

  it("shows no warning when total requested is less than the available amount", async () => {
    // Available = $50,000, requested = $5,000. Well under budget, so
    // neither the over-budget nor the under-distribution warning applies.
    mockGrantsResponse({
      currentCycleAmount: 50000,
      grants: [
        apiGrant({ id: "g1", arccAmountRequested: 5000, finalPercent: 95 }),
      ],
    });

    render(<AllocationPage />);

    await waitFor(() => expect(axios.get).toHaveBeenCalled());

    expect(
      screen.queryByText(/you are allocating more money than available/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/leaving more than 5% of the available money unused/i),
    ).not.toBeInTheDocument();
  });

  it("shows the under-distribution warning when enough was requested but allocation falls more than 5% short", async () => {
    // Available = $100,000. Requested = $90,000 (fully funded) +
    // $30,000 (rejected, below cutoff) = $120,000 total requested.
    // Allocated = $90,000, which is $10,000 short — more than 5% of
    // the $100,000 available.
    mockGrantsResponse({
      currentCycleAmount: 100000,
      grants: [
        apiGrant({ id: "g1", arccAmountRequested: 90000, finalPercent: 95 }),
        apiGrant({ id: "g2", arccAmountRequested: 30000, finalPercent: 50 }),
      ],
    });

    render(<AllocationPage />);

    expect(
      await screen.findByText(
        /leaving more than 5% of the available money unused/i,
      ),
    ).toBeInTheDocument();
  });

  it("does not show the under-distribution warning exactly at the 95% boundary", async () => {
    // Available = $100,000, requested = $100,000, allocated = exactly
    // $95,000 (95% award rate). The rule is "at least 95%", so this
    // must NOT warn.
    mockGrantsResponse({
      currentCycleAmount: 100000,
      criteria: [
        { fromPercentage: 90, toPercentage: 100, awardPercentage: 95 },
      ],
      grants: [
        apiGrant({ id: "g1", arccAmountRequested: 100000, finalPercent: 100 }),
      ],
    });

    render(<AllocationPage />);

    await waitFor(() => expect(axios.get).toHaveBeenCalled());

    expect(
      screen.queryByText(/leaving more than 5% of the available money unused/i),
    ).not.toBeInTheDocument();
  });

  it("blocks finishing the allocation when over-budget and does not call finalize", async () => {
    mockGrantsResponse({
      currentCycleAmount: 10000,
      grants: [
        apiGrant({ id: "g1", arccAmountRequested: 20000, finalPercent: 95 }),
      ],
    });

    const user = userEvent.setup();
    render(<AllocationPage />);

    await screen.findByText(/you are allocating more money than available/i);

    await user.click(
      screen.getByRole("button", { name: /finish allocation/i }),
    );

    expect(axios.post).not.toHaveBeenCalledWith(
      "http://localhost:5000/api/allocation/finalize",
      expect.anything(),
      expect.anything(),
    );
  });

  it("blocks finishing the allocation when under-distributed and does not call finalize", async () => {
    mockGrantsResponse({
      currentCycleAmount: 100000,
      grants: [
        apiGrant({ id: "g1", arccAmountRequested: 90000, finalPercent: 95 }),
        apiGrant({ id: "g2", arccAmountRequested: 30000, finalPercent: 50 }),
      ],
    });

    const user = userEvent.setup();
    render(<AllocationPage />);

    await screen.findByText(
      /leaving more than 5% of the available money unused/i,
    );

    await user.click(
      screen.getByRole("button", { name: /finish allocation/i }),
    );

    expect(axios.post).not.toHaveBeenCalledWith(
      "http://localhost:5000/api/allocation/finalize",
      expect.anything(),
      expect.anything(),
    );
  });

  it("finalizes successfully when allocation is within budget and sufficiently distributed", async () => {
    // Available = $50,000, one grant fully funded for the full amount.
    // No over-budget, no under-distribution: should be allowed through.
    mockGrantsResponse({
      currentCycleAmount: 50000,
      grants: [
        apiGrant({ id: "g1", arccAmountRequested: 50000, finalPercent: 95 }),
      ],
    });

    const user = userEvent.setup();
    render(<AllocationPage />);

    await waitFor(() => expect(axios.get).toHaveBeenCalled());

    await user.click(
      screen.getByRole("button", { name: /finish allocation/i }),
    );

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        "http://localhost:5000/api/allocation/finalize",
        expect.objectContaining({
          currentCycleAmount: 50000,
          totalAllocated: 50000,
        }),
        expect.objectContaining({
          headers: { Authorization: "Bearer tok123" },
        }),
      );
    });

    expect(
      await screen.findByText(/allocation finalized successfully/i),
    ).toBeInTheDocument();
  });

  it("disables Send to Accounting until the allocation is finalized", async () => {
    render(<AllocationPage />);

    await waitFor(() => expect(axios.get).toHaveBeenCalled());

    expect(
      screen.getByRole("button", { name: /send to accounting/i }),
    ).toBeDisabled();
  });

  it("enables Send to Accounting when the cycle is already finalized", async () => {
    mockGrantsResponse({ finalized: true });

    render(<AllocationPage />);

    await screen.findByText(/this allocation cycle has been finalized/i);

    expect(
      screen.getByRole("button", { name: /send to accounting/i }),
    ).toBeEnabled();
  });

  it("enables Send to Accounting after Finish Allocation succeeds", async () => {
    mockGrantsResponse({
      currentCycleAmount: 50000,
      grants: [
        apiGrant({ id: "g1", arccAmountRequested: 50000, finalPercent: 95 }),
      ],
    });

    const user = userEvent.setup();
    render(<AllocationPage />);

    await waitFor(() => expect(axios.get).toHaveBeenCalled());

    expect(
      screen.getByRole("button", { name: /send to accounting/i }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole("button", { name: /finish allocation/i }),
    );

    await screen.findByText(/allocation finalized successfully/i);

    expect(
      screen.getByRole("button", { name: /send to accounting/i }),
    ).toBeEnabled();
  });

  it("shows the finalized banner and disables editing when the cycle is already finalized", async () => {
    mockGrantsResponse({ finalized: true });

    render(<AllocationPage />);

    expect(
      await screen.findByText(/this allocation cycle has been finalized/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /allocation finalized/i }),
    ).toBeDisabled();
  });
});
