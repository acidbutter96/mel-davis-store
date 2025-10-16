"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
	const search = useSearchParams();
	const token = search.get("token") || "";
	const [status, setStatus] = useState<string | null>(null);
	const [passwordValue, setPasswordValue] = useState("");
	const [confirmValue, setConfirmValue] = useState("");
	const [validating, setValidating] = useState(true);
	const [tokenValid, setTokenValid] = useState<boolean | null>(null);
	const router = useRouter();

	const strength = useMemo(() => {
		const pw = passwordValue;
		return {
			length: pw.length >= 10,
			upper: /[A-Z]/.test(pw),
			lower: /[a-z]/.test(pw),
			digit: /[0-9]/.test(pw),
			special: /[^A-Za-z0-9]/.test(pw),
		};
	}, [passwordValue]);
	const isStrong = strength.length && strength.upper && strength.lower && strength.digit && strength.special;

	useEffect(() => {
		let mounted = true;
		async function validate() {
			if (!token) {
				if (mounted) {
					setTokenValid(false);
					setValidating(false);
				}
				return;
			}
			try {
				const res = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`);
				const data = (await res.json()) as { valid?: boolean; error?: string };
				if (mounted) {
					setTokenValid(!!data?.valid);
					if (!data?.valid && data?.error) setStatus(data.error);
					setValidating(false);
				}
			} catch (err) {
				if (mounted) {
					setTokenValid(false);
					setStatus("Unable to validate token");
					setValidating(false);
				}
			}
		}
		validate();
		return () => {
			mounted = false;
		};
	}, [token]);

	return (
		<div className="max-w-md mx-auto p-6">
			<h2 className="text-xl font-semibold mb-4">Reset your password</h2>
			{validating ? (
				<p className="text-sm text-muted-foreground">Validating token...</p>
			) : tokenValid === false ? (
				<div>
					<p className="text-sm text-red-500">{status || "Invalid or expired token."}</p>
					<div className="mt-3">
						<Button variant="secondary" onClick={() => router.push("/login")}>
							Back to login
						</Button>
					</div>
				</div>
			) : (
				<form
					onSubmit={async (e) => {
						e.preventDefault();
						setStatus(null);
						if (!isStrong) return setStatus("Password does not meet strength requirements");
						if (passwordValue !== confirmValue) return setStatus("Passwords do not match");
						try {
							const res = await fetch("/api/auth/reset-password", {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ token, password: passwordValue }),
							});
							if (res.ok) {
								// Immediately navigate to login and show flash
								router.push("/login?reset=1");
								return;
							} else {
								const data = (await res.json()) as { error?: string };
								setStatus(data?.error || "Failed to reset password");
							}
						} catch (err) {
							setStatus("Unexpected error");
						}
					}}
				>
					<div className="grid gap-2">
						<Label htmlFor="password">New password</Label>
						<Input
							name="password"
							type="password"
							value={passwordValue}
							onChange={(e) => setPasswordValue((e.target as HTMLInputElement).value)}
						/>
						<Label htmlFor="confirm">Confirm password</Label>
						<Input
							name="confirm"
							type="password"
							value={confirmValue}
							onChange={(e) => setConfirmValue((e.target as HTMLInputElement).value)}
						/>
						<div className="text-sm text-muted-foreground">
							<div>Password strength:</div>
							<ul className="list-disc ml-5">
								<li className={strength.length ? "text-green-500" : "text-red-500"}>
									At least 10 characters
								</li>
								<li className={strength.upper ? "text-green-500" : "text-red-500"}>Uppercase letter</li>
								<li className={strength.lower ? "text-green-500" : "text-red-500"}>Lowercase letter</li>
								<li className={strength.digit ? "text-green-500" : "text-red-500"}>Digit</li>
								<li className={strength.special ? "text-green-500" : "text-red-500"}>Special character</li>
							</ul>
						</div>
						<div className="flex gap-2 mt-2">
							<Button type="submit" disabled={!isStrong || passwordValue !== confirmValue}>
								Set new password
							</Button>
						</div>
						{status && <p className="text-sm mt-2">{status}</p>}
					</div>
				</form>
			)}
			{/* immediate redirect handled on success */}
		</div>
	);
}
