"use client";

import { useEffect, useId, useRef, useState } from "react";
import { displayNameEditEvent, useDisplayName } from "@/lib/use-display-name";

export function DisplayNameManager() {
	const { displayName, isLoaded, saveDisplayName } = useDisplayName();
	const [isOpen, setIsOpen] = useState(false);
	const [draft, setDraft] = useState("");
	const dialog = useRef<HTMLDialogElement>(null);
	const input = useRef<HTMLInputElement>(null);
	const titleId = useId();

	useEffect(() => {
		if (isLoaded && !displayName.trim()) {
			setDraft("");
			setIsOpen(true);
		}
	}, [isLoaded, displayName]);

	useEffect(() => {
		const openEditor = () => {
			setDraft(displayName);
			setIsOpen(true);
		};
		window.addEventListener(displayNameEditEvent, openEditor);
		return () => window.removeEventListener(displayNameEditEvent, openEditor);
	}, [displayName]);

	useEffect(() => {
		const element = dialog.current;
		if (!element) return;
		if (isOpen && !element.open) {
			element.showModal();
			input.current?.focus();
		}
		if (!isOpen && element.open) element.close();
	}, [isOpen]);

	function save(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const name = draft.trim().slice(0, 32);
		if (!name) return;
		saveDisplayName(name);
		setIsOpen(false);
	}

	return (
		<>
			{!isLoaded && (
				<div
					aria-live="polite"
					className="fixed inset-0 z-[100] grid place-items-center bg-white/90 text-sm text-slate-500 backdrop-blur-sm"
					role="status"
				>
					表示名を確認しています…
				</div>
			)}
			<dialog
				aria-labelledby={titleId}
				className="m-auto w-[calc(100%-2rem)] max-w-md border-0 bg-transparent p-0 text-slate-900 backdrop:bg-slate-950/50"
				onCancel={(event) => {
					event.preventDefault();
					if (displayName.trim()) setIsOpen(false);
				}}
				onClose={() => {
					if (!displayName.trim()) {
						setIsOpen(false);
						window.setTimeout(() => setIsOpen(true), 0);
					}
				}}
				ref={dialog}
			>
				<form className="rounded-2xl bg-white p-6 shadow-xl" onSubmit={save}>
					<h2 className="text-lg font-semibold" id={titleId}>
						{displayName.trim() ? "表示名を変更" : "表示名を設定"}
					</h2>
					<p className="mt-2 text-sm leading-6 text-slate-600">
						コメントや投票、譜面の投稿者名に使います。
					</p>
					<label className="mt-5 block text-sm font-medium text-slate-700">
						名前
						<input
							autoComplete="name"
							className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2"
							maxLength={32}
							onChange={(event) => setDraft(event.target.value)}
							placeholder="表示名"
							ref={input}
							required
							value={draft}
						/>
					</label>
					<div className="mt-6 flex justify-end gap-3">
						{displayName.trim() && (
							<button
								className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
								onClick={() => {
									setDraft(displayName);
									setIsOpen(false);
								}}
								type="button"
							>
								キャンセル
							</button>
						)}
						<button
							className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
							disabled={!draft.trim()}
							type="submit"
						>
							保存
						</button>
					</div>
				</form>
			</dialog>
		</>
	);
}
