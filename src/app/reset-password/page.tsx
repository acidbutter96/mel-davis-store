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
	const [countdown, setCountdown] = useState<number | null>(null);
	const router = useRouter();

	useEffect(() => {
		if (countdown === null) return;
		if (countdown <= 0) {
			router.push("/login");
			return;
		}
		const t = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
		return () => clearTimeout(t);
	}, [countdown, router]);

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

	return (
		<div className="max-w-md mx-auto p-6">
			<h2 className="text-xl font-semibold mb-4">Reset your password</h2>
			{!token ? (
				<p className="text-sm text-muted-foreground">Missing token. Use the link from your email.</p>
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
								setStatus("Password updated. Redirecting to login...");
								setCountdown(3);
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
			{countdown !== null && (
				<div className="mt-4 text-center text-sm">Redirecting to login in {countdown}...</div>
			)}
		</div>
	);
}
