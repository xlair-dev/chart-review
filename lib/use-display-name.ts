"use client";

import { useEffect, useState } from "react";

const storageKey = "chart-review-display-name";
const eventName = "chart-review-display-name-change";

export function useDisplayName() {
	const [displayName, setDisplayName] = useState("");

	useEffect(() => {
		setDisplayName(localStorage.getItem(storageKey) ?? "");
		const syncName = () =>
			setDisplayName(localStorage.getItem(storageKey) ?? "");
		window.addEventListener(eventName, syncName);
		return () => window.removeEventListener(eventName, syncName);
	}, []);

	function saveDisplayName(name: string) {
		const next = name.trim().slice(0, 32);
		localStorage.setItem(storageKey, next);
		setDisplayName(next);
		window.dispatchEvent(new Event(eventName));
	}

	return { displayName, saveDisplayName };
}
