"use client";

import { useEffect, useState } from "react";

const storageKey = "chart-review-display-name";
const eventName = "chart-review-display-name-change";
export const displayNameEditEvent = "chart-review-display-name-edit";

export function requestDisplayNameEdit() {
	window.dispatchEvent(new Event(displayNameEditEvent));
}

export function useDisplayName() {
	const [displayName, setDisplayName] = useState("");
	const [isLoaded, setIsLoaded] = useState(false);

	useEffect(() => {
		setDisplayName(localStorage.getItem(storageKey) ?? "");
		setIsLoaded(true);
		const syncName = () =>
			setDisplayName(localStorage.getItem(storageKey) ?? "");
		window.addEventListener(eventName, syncName);
		return () => window.removeEventListener(eventName, syncName);
	}, []);

	function saveDisplayName(name: string) {
		const next = name.trim().slice(0, 32);
		localStorage.setItem(storageKey, next);
		setDisplayName(next);
		setIsLoaded(true);
		window.dispatchEvent(new Event(eventName));
	}

	return { displayName, isLoaded, saveDisplayName };
}
