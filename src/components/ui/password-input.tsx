"use client";
import { Eye, EyeOff } from "lucide-react";
import * as React from "react";
/**
 * PasswordInput
 * Reusable password component with show/hide toggle.
 * Usage:
 * <PasswordInput name="password" required />
 * Accepts all <input> props. Use containerClassName to style the wrapper.
 */
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
					className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-500 hover:text-gray-800"
					tabIndex={-1}
				>
					{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
				</button>
			</div>
		);
	},
);
PasswordInput.displayName = "PasswordInput";
