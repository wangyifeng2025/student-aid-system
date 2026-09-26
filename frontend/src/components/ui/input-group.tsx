"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "group/input-group relative flex w-full items-center rounded-md border border-line bg-surface shadow-card outline-none",
        "h-9 min-w-0 has-[>textarea]:h-auto",
        "has-[>[data-align=inline-start]]:[&>input]:pl-2",
        "has-[>[data-align=inline-end]]:[&>input]:pr-2",
        "has-[[data-slot=input-group-control]:focus-visible]:border-brand has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-brand-light",
        className,
      )}
      {...props}
    />
  );
}

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-ink-mute select-none [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        "inline-start": "order-first pl-2 has-[>button]:ml-[-0.3rem]",
        "inline-end": "order-last pr-1.5 has-[>button]:mr-[-0.15rem]",
        "block-start": "order-first w-full justify-start px-3 pt-3",
        "block-end": "order-last w-full justify-start px-3 pb-3",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  },
);

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        e.currentTarget.parentElement?.querySelector("input")?.focus();
      }}
      {...props}
    />
  );
}

const inputGroupButtonVariants = cva("flex items-center text-sm shadow-none", {
  variants: {
    size: {
      xs: "h-6 gap-1 rounded-sm px-2",
      sm: "h-8 gap-1.5 rounded-md px-2.5",
      "icon-xs": "size-6 rounded-sm p-0",
      "icon-sm": "size-8 p-0",
    },
  },
  defaultVariants: {
    size: "xs",
  },
});

function InputGroupButton({
  className,
  type = "button",
  size = "xs",
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof inputGroupButtonVariants>) {
  return (
    <button
      type={type}
      data-size={size}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  );
}

function InputGroupInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "h-8 flex-1 rounded-none border-0 bg-transparent px-2 text-xs shadow-none focus:border-transparent focus:ring-0",
        className,
      )}
      {...props}
    />
  );
}

export { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput };
