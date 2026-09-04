import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { StatBadge } from "@/components/ui/StatBadge";
import { DashboardCard } from "@/components/layout/DashboardCard";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

describe("Phase 1 UI Components", () => {
  describe("StatBadge Threshold Colors", () => {
    it("renders green/emerald for percentage >= threshold (85% >= 75%)", () => {
      const { container } = render(<StatBadge percentage={85} threshold={75} />);
      expect(screen.getByText("85.0%")).toBeInTheDocument();
      expect(container.firstChild).toHaveClass("bg-emerald-50");
    });

    it("renders amber/warning for percentage near threshold (70% in 65-74%)", () => {
      const { container } = render(<StatBadge percentage={70} threshold={75} nearDelta={10} />);
      expect(screen.getByText("70.0%")).toBeInTheDocument();
      expect(container.firstChild).toHaveClass("bg-amber-50");
    });

    it("renders red/rose for percentage below threshold (55% < 65%)", () => {
      const { container } = render(<StatBadge percentage={55} threshold={75} nearDelta={10} />);
      expect(screen.getByText("55.0%")).toBeInTheDocument();
      expect(container.firstChild).toHaveClass("bg-rose-50");
    });
  });

  describe("PageContainer", () => {
    it("renders title, description and children", () => {
      render(
        <PageContainer title="Test Page" description="Test Description">
          <div data-testid="content">Child Content</div>
        </PageContainer>
      );
      expect(screen.getByText("Test Page")).toBeInTheDocument();
      expect(screen.getByText("Test Description")).toBeInTheDocument();
      expect(screen.getByTestId("content")).toBeInTheDocument();
    });
  });

  describe("DashboardCard", () => {
    it("renders metric title and value", () => {
      render(<DashboardCard title="Total Students" value={118} description="Registered" />);
      expect(screen.getByText("Total Students")).toBeInTheDocument();
      expect(screen.getByText("118")).toBeInTheDocument();
      expect(screen.getByText("Registered")).toBeInTheDocument();
    });
  });

  describe("Button & Badge", () => {
    it("renders Button and Badge with variants", () => {
      render(
        <div>
          <Button variant="primary">Click Me</Button>
          <Badge variant="success">Active</Badge>
        </div>
      );
      expect(screen.getByText("Click Me")).toBeInTheDocument();
      expect(screen.getByText("Active")).toBeInTheDocument();
    });
  });
});
