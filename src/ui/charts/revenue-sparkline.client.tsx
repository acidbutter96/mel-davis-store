"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useAdminTheme } from "@/app/admin/_components/admin-theme-provider.client";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

type RevenueSparklineProps = {
	seriesCents: number[];
	labels: string[]; // ISO date (YYYY-MM-DD)
	currency: string;
	height?: number;
};

export function RevenueSparkline({ seriesCents, labels, currency, height = 80 }: RevenueSparklineProps) {
	const { theme } = useAdminTheme();
	const options: ApexOptions = useMemo(
		() => ({
			theme: { mode: theme },
			chart: { type: "area", sparkline: { enabled: true }, animations: { enabled: true } },
			stroke: { curve: "smooth", width: 2 },
			fill: { type: "gradient", gradient: { shadeIntensity: 0.3, opacityFrom: 0.4, opacityTo: 0.1 } },
			colors: [theme === "dark" ? "#34d399" : "#22c55e"],
			tooltip: {
				x: { formatter: (val: number) => String(val) },
				y: {
					formatter: (val: number) => {
						try {
							return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(val / 100);
						} catch {
							return `${(val / 100).toFixed(2)} ${currency}`;
						}
					},
				},
			},
			xaxis: { type: "category", categories: labels },
			dataLabels: { enabled: false },
		}),
		[labels, currency, theme],
	);

	const series = useMemo(() => [{ name: "Revenue", data: seriesCents }], [seriesCents]);

	return <ReactApexChart options={options} series={series} type="area" height={height} />;
}
