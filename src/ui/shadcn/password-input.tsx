"use client";
import { Eye, EyeOff } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/ui/shadcn/input";

/**
 * PasswordInput
 * Reusable password component with show/hide toggle.
 * Usage: <PasswordInput name="password" required />
 */
export interface PasswordInputProps extends React.ComponentPropsWithoutRef<"input"> {
	containerClassName?: string;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
	({ className, containerClassName, ...props }, ref) => {
		const [visible, setVisible] = React.useState(false);
		return (
			<div className={cn("relative", containerClassName)}>
				<Input ref={ref} type={visible ? "text" : "password"} className={cn("pr-10", className)} {...props} />
				<button
					type="button"
					aria-label={visible ? "Hide password" : "Show password"}
					onClick={() => setVisible((v) => !v)}
					className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground hover:text-foreground"
					tabIndex={-1}
				>
					{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
				</button>
			</div>
		);
	},
);
PasswordInput.displayName = "PasswordInput";
