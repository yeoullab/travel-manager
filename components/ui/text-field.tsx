import * as React from "react";
import { cn } from "@/lib/cn";

type TextFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField({ label, hint, error, id, className, ...props }, ref) {
    const inputId = id ?? React.useId();
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-[13px] font-medium text-ink-700">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={hint || error ? `${inputId}-hint` : undefined}
          className={cn(
            "h-11 rounded-[8px] border bg-surface-100 px-3 text-[15px] text-ink-900",
            "placeholder:text-ink-500 transition-colors duration-150",
            error ? "border-error" : "border-border-primary focus:border-border-medium",
            "focus:outline-none focus:shadow-[0_4px_12px_rgba(0,0,0,0.1)]",
            className,
          )}
          {...props}
        />
        {(hint || error) && (
          <p
            id={`${inputId}-hint`}
            className={cn("text-[12px]", error ? "text-error" : "text-ink-600")}
          >
            {error ?? hint}
          </p>
        )}
      </div>
    );
  },
);

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea({ label, hint, error, id, className, ...props }, ref) {
    const inputId = id ?? React.useId();
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-[13px] font-medium text-ink-700">
            {label}
          </label>
        )}
        <textarea
          id={inputId}
          ref={ref}
          rows={4}
          className={cn(
            "min-h-[88px] rounded-[8px] border bg-surface-100 px-3 py-2 text-[15px] text-ink-900",
            "placeholder:text-ink-500 transition-colors duration-150 resize-y",
            error ? "border-error" : "border-border-primary focus:border-border-medium",
            "focus:outline-none focus:shadow-[0_4px_12px_rgba(0,0,0,0.1)]",
            className,
          )}
          {...props}
        />
        {(hint || error) && (
          <p className={cn("text-[12px]", error ? "text-error" : "text-ink-600")}>
            {error ?? hint}
          </p>
        )}
      </div>
    );
  },
);
