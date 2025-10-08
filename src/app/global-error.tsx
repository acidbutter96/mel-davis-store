"use client";

import { useState } from "react";
import { useTranslations } from "@/i18n/client";

function safeT() {
	try {
		return useTranslations("Global.globalError");
	} catch {
		return (k: string) => {
			switch (k) {
				case "title":
					return "Something went wrong";
				case "moreDetails":
					return "More details";
				case "tryAgainButton":
					return "Try again";
				default:
					return k;
			}
		};
	}
}

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	const [, force] = useState(0);
	const t = safeT();

	return (
		<html>
			<body>
				<h2>{t("title")}</h2>
				<p>{error.message}</p>
				{(error.digest || error.stack) && (
					<details>
						<summary>{t("moreDetails")}</summary>
						{error.digest && <p>{error.digest}</p>}
						{error.stack && <pre>{error.stack}</pre>}
					</details>
				)}
				<button
					onClick={() => {
						try {
							reset();
						} catch {
							force((n) => n + 1);
						}
					}}
					className="psychedelic-button mt-4 inline-flex items-center justify-center gap-2 rounded-md px-6 py-2 text-base font-semibold"
				>
					{t("tryAgainButton")}
				</button>
			</body>
		</html>
	);
}
