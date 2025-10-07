"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProcessingClient() {
	const router = useRouter();
	const [done, setDone] = useState(false);

	useEffect(() => {
		const spinnerTimer = setTimeout(() => setDone(true), 1800);
		const redirectTimer = setTimeout(() => {
			router.replace("/orders");
		}, 2800);
		return () => {
			clearTimeout(spinnerTimer);
			clearTimeout(redirectTimer);
		};
	}, [router]);

	return (
		<div className="flex flex-col items-center">
			<div className="relative w-20 h-20 mb-6">
				{!done && (
					<div className="absolute inset-0 animate-spin rounded-full border-4 border-muted border-t-primary" />
				)}
				<div
					className={`absolute inset-0 flex items-center justify-center transition-opacity ${done ? "opacity-100" : "opacity-0"}`}
				>
					<svg
						className="w-14 h-14 text-primary"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M20 6L9 17l-5-5" />
					</svg>
				</div>
			</div>
			<p className="text-sm font-medium mb-2">Please wait...</p>
			<p className="text-xs text-muted-foreground">You will be redirected to your orders shortly.</p>
		</div>
	);
}
