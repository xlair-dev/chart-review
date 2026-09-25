"use client";

import { useEffect, useState } from "react";
import { useDisplayName } from "@/lib/use-display-name";

export function DisplayNameField() {
	const { displayName, saveDisplayName } = useDisplayName();
	const [draft, setDraft] = useState(displayName);
	useEffect(() => setDraft(displayName), [displayName]);

	return (
		<label className="block max-w-sm text-sm font-medium text-slate-700">
			表示名
			<div className="mt-2 flex gap-2">
				<input
					className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
					maxLength={32}
					onChange={(event) => setDraft(event.target.value)}
					placeholder="コメントに表示する名前"
					value={draft}
				/>
				<button
					className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-40"
					disabled={!draft.trim() || draft.trim() === displayName}
					onClick={() => saveDisplayName(draft)}
					type="button"
				>
					保存
				</button>
			</div>
		</label>
	);
}
