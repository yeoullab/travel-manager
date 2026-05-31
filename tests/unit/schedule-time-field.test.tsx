import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { ScheduleTimeField } from "@/components/schedule/schedule-time-field";

describe("ScheduleTimeField", () => {
  it("renders desktop AM before PM and emits 24-hour values", () => {
    const onChange = vi.fn();
    render(<ScheduleTimeField value="" onChange={onChange} mode="custom" />);

    const am = screen.getByRole("button", { name: "오전" });
    const pm = screen.getByRole("button", { name: "오후" });
    const buttons = screen.getAllByRole("button").map((button) => button.textContent);
    expect(buttons.indexOf("오전")).toBeLessThan(buttons.indexOf("오후"));
    expect(am).toHaveAttribute("aria-pressed", "false");
    expect(pm).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("시")).toHaveValue("");
    expect(screen.getByLabelText("분")).toHaveValue("");

    fireEvent.click(pm);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith("21:00");
    fireEvent.change(screen.getByLabelText("시"), { target: { value: "05" } });
    fireEvent.change(screen.getByLabelText("분"), { target: { value: "16" } });

    expect(onChange).toHaveBeenLastCalledWith("17:16");
    expect(am).toHaveAttribute("aria-pressed", "false");
    expect(pm).toHaveAttribute("aria-pressed", "true");
  });

  it("renders native time input in native mode", () => {
    const onChange = vi.fn();
    render(<ScheduleTimeField value="05:18" onChange={onChange} mode="native" />);

    const input = screen.getByLabelText("시간");
    expect(input).toHaveAttribute("type", "time");
    fireEvent.change(input, { target: { value: "06:30" } });
    expect(onChange).toHaveBeenCalledWith("06:30");
  });
});
