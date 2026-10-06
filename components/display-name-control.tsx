"use client";

import { requestDisplayNameEdit, useDisplayName } from "@/lib/use-display-name";

export function DisplayNameControl() {
	const { displayName } = useDisplayName();
	return (
		<button
			aria-label={`表示名を変更: ${displayName || "未設定"}`}
			className="max-w-28 truncate rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-sky-300 hover:text-sky-800 sm:max-w-56"
			onClick={requestDisplayNameEdit}
			title="クリックして表示名を変更"
			type="button"
		>
			{displayName || "名前を設定"}
		</button>
	);
}
