import * as React from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import { cn } from "../../lib/utils";

const EMPTY_SELECT_VALUE = "__azn_empty_select_value__";

type SelectChangeEvent = {
  target: {
    name?: string;
    value: string;
  };
};

type SelectOption = {
  disabled?: boolean;
  label: React.ReactNode;
  value: string;
};

type SelectProps = Omit<
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>,
  "defaultValue" | "onValueChange" | "value"
> & {
  "aria-label"?: string;
  className?: string;
  defaultValue?: string;
  id?: string;
  onChange?: (event: SelectChangeEvent) => void;
  placeholder?: string;
  value?: string;
};

function Select({
  "aria-label": ariaLabel,
  children,
  className,
  defaultValue,
  disabled,
  id,
  name,
  onChange,
  placeholder = "请选择",
  value,
  ...props
}: SelectProps) {
  const options = React.useMemo(() => extractSelectOptions(children), [children]);
  const selectedOption = options.find((option) => option.value === (value ?? defaultValue));

  return (
    <SelectPrimitive.Root
      {...props}
      defaultValue={encodeSelectValue(defaultValue)}
      disabled={disabled}
      name={name}
      value={encodeSelectValue(value)}
      onValueChange={(nextValue) => {
        onChange?.({ target: { name, value: decodeSelectValue(nextValue) } });
      }}
    >
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          "flex h-10 w-full max-sm:h-11 cursor-pointer items-center justify-between gap-2 rounded-lg border border-input bg-card px-3.5 text-base text-foreground md:text-sm outline-none transition-[background-color,border-color,box-shadow] duration-200 ease-(--ease-out-ui) hover:border-foreground/35 focus-visible:border-ring focus-visible:bg-card focus-visible:ring-1 focus-visible:ring-ring/20 data-[state=open]:border-primary/70 data-[state=open]:ring-1 data-[state=open]:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
          className,
        )}
        data-slot="select"
        id={id}
      >
        <span className="min-w-0 truncate text-left">
          <SelectPrimitive.Value placeholder={selectedOption?.label ?? placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 in-data-[state=open]:rotate-180 motion-reduce:transition-none" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) origin-(--radix-select-content-transform-origin) overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-(--shadow-glass-strong) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none"
          position="popper"
          sideOffset={6}
        >
          <SelectPrimitive.ScrollUpButton className="flex h-7 items-center justify-center border-b border-border/60 bg-popover text-muted-foreground">
            <ChevronUp className="size-3.5" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="max-h-72 p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                className="relative flex min-h-10 cursor-pointer items-center rounded-md py-2 pr-9 pl-3 text-base transition-colors outline-none select-none focus:bg-accent focus:text-accent-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50 data-[state=checked]:font-medium data-[state=checked]:text-primary motion-reduce:transition-none md:min-h-9 md:text-sm"
                disabled={option.disabled}
                value={encodeSelectValue(option.value) ?? EMPTY_SELECT_VALUE}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex items-center">
                  <Check className="size-4" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex h-7 items-center justify-center border-t border-border/60 bg-popover text-muted-foreground">
            <ChevronDown className="size-3.5" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

function extractSelectOptions(children: React.ReactNode): SelectOption[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement(child) || child.type !== "option") {
      return [];
    }

    const props = child.props as React.OptionHTMLAttributes<HTMLOptionElement>;
    const label = props.children;

    return [
      {
        disabled: props.disabled,
        label,
        value: props.value == null ? stringifyLabel(label) : String(props.value),
      },
    ];
  });
}

function encodeSelectValue(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  return value === "" ? EMPTY_SELECT_VALUE : value;
}

function decodeSelectValue(value: string) {
  return value === EMPTY_SELECT_VALUE ? "" : value;
}

function stringifyLabel(label: React.ReactNode) {
  if (typeof label === "string" || typeof label === "number") {
    return String(label);
  }

  return "";
}

export { Select };
export type { SelectChangeEvent };
