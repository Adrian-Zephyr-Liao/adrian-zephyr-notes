import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
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
          "flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-(--glass-border) bg-background/45 px-3 text-sm text-foreground shadow-xs outline-none backdrop-blur-md transition-[background-color,border-color,box-shadow,scale] duration-200 ease-(--ease-out-ui) focus-visible:border-ring focus-visible:bg-background/70 focus-visible:ring-3 focus-visible:ring-ring/35 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100",
          className,
        )}
        data-slot="select"
        id={id}
      >
        <SelectPrimitive.Value placeholder={selectedOption?.label ?? placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="z-50 max-h-80 min-w-(--radix-select-trigger-width) origin-(--radix-select-content-transform-origin) overflow-hidden rounded-lg border border-(--glass-border) bg-(--glass-surface-strong) text-popover-foreground shadow-(--shadow-glass-strong) backdrop-blur-2xl"
          position="popper"
          sideOffset={6}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                className="relative flex cursor-pointer items-center rounded-md py-1.5 pr-8 pl-2 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50"
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
