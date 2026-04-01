import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ConfirmationDialog, ConfirmationProvider, useConfirmation } from "../ui/confirmation";

describe("Button", () => {
  it("renders with children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("applies variant classes", () => {
    render(<Button variant="destructive">Delete</Button>);
    const btn = screen.getByRole("button", { name: "Delete" });
    expect(btn.className).toContain("bg-red-500");
  });

  it("applies size classes", () => {
    render(<Button size="sm">Small</Button>);
    const btn = screen.getByRole("button", { name: "Small" });
    expect(btn.className).toContain("h-9");
  });

  it("forwards disabled state", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button", { name: "Disabled" })).toBeDisabled();
  });

  it("handles click events", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Press</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Press" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("Input", () => {
  it("renders an input element", () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("forwards type prop", () => {
    render(<Input type="email" placeholder="Email" />);
    expect(screen.getByPlaceholderText("Email")).toHaveAttribute("type", "email");
  });

  it("applies custom className", () => {
    render(<Input className="custom-class" placeholder="test" />);
    expect(screen.getByPlaceholderText("test").className).toContain("custom-class");
  });

  it("forwards disabled state", () => {
    render(<Input disabled placeholder="disabled" />);
    expect(screen.getByPlaceholderText("disabled")).toBeDisabled();
  });
});

describe("Label", () => {
  it("renders with text content", () => {
    render(<Label>Username</Label>);
    expect(screen.getByText("Username")).toBeInTheDocument();
  });

  it("associates with input via htmlFor", () => {
    render(
      <>
        <Label htmlFor="email-input">Email</Label>
        <Input id="email-input" />
      </>,
    );
    const label = screen.getByText("Email");
    expect(label).toHaveAttribute("for", "email-input");
  });
});

describe("ConfirmationDialog", () => {
  it("renders when open", () => {
    render(
      <ConfirmationDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete item?"
        description="This cannot be undone."
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText("Delete item?")).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <ConfirmationDialog
        open={false}
        onOpenChange={() => {}}
        title="Delete item?"
        onConfirm={() => {}}
      />,
    );
    expect(screen.queryByText("Delete item?")).not.toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        open={true}
        onOpenChange={() => {}}
        title="Confirm?"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onOpenChange(false) when cancel button is clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <ConfirmationDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Confirm?"
        onConfirm={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders danger variant with alert icon", () => {
    render(
      <ConfirmationDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete?"
        variant="danger"
        onConfirm={() => {}}
      />,
    );
    const confirmBtn = screen.getByRole("button", { name: "Confirm" });
    expect(confirmBtn.className).toContain("bg-red-500");
  });

  it("shows loading state", () => {
    render(
      <ConfirmationDialog
        open={true}
        onOpenChange={() => {}}
        title="Processing"
        loading={true}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText("Please wait...")).toBeInTheDocument();
  });

  it("renders custom labels", () => {
    render(
      <ConfirmationDialog
        open={true}
        onOpenChange={() => {}}
        title="Custom"
        confirmLabel="Yes, do it"
        cancelLabel="No, go back"
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Yes, do it" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No, go back" })).toBeInTheDocument();
  });
});

describe("ConfirmationProvider + useConfirmation", () => {
  function TestConsumer() {
    const { confirm } = useConfirmation();
    return (
      <button
        onClick={async () => {
          await confirm({ title: "Are you sure?", description: "Think twice." });
        }}
      >
        Trigger
      </button>
    );
  }

  it("shows dialog when confirm is called", async () => {
    render(
      <ConfirmationProvider>
        <TestConsumer />
      </ConfirmationProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Trigger" }));
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    expect(screen.getByText("Think twice.")).toBeInTheDocument();
  });

  it("throws when used outside provider", () => {
    expect(() => {
      render(<TestConsumer />);
    }).toThrow("useConfirmation must be used within <ConfirmationProvider>");
  });
});
