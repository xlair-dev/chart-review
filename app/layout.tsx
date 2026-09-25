import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Chart Review | XLAIR",
	description: "譜面制作のフィードバックを支援するツール",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="ja">
			<body>{children}</body>
		</html>
	);
}
