// Floating corner sticker that shows while Pomodoro timer is running
// Injected as a content script across all tabs

(function initSticker() {
	const STICKER_ID = 'lapse-sticker';
	const HIDE_CLASS = 'lapse-sticker-hide';

	function createStyles() {
		if (document.getElementById('lapse-sticker-style')) return;
		const style = document.createElement('style');
		style.id = 'lapse-sticker-style';
		style.textContent = `
			#${STICKER_ID} { position: fixed; right: 14px; bottom: 14px; z-index: 2147483647; font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
			#${STICKER_ID} .card { display: flex; align-items: center; justify-content: center; padding: 8px 12px; border-radius: 10px; color: #000; background: #ffffff; box-shadow: 0 8px 24px rgba(0,0,0,0.10); transition: transform 0.18s ease, opacity 0.18s ease; user-select: none; }
			#${STICKER_ID}.dark .card { color: #e0e0e0; background: #1a1a1a; box-shadow: 0 8px 24px rgba(0,0,0,0.35); }
			#${STICKER_ID}.${HIDE_CLASS} { opacity: 0; pointer-events: none; transform: translateY(8px) scale(0.98); }
			#${STICKER_ID} .time { font-weight: 700; letter-spacing: -0.2px; min-width: 64px; text-align: center; font-variant-numeric: tabular-nums; }
		`;
		document.documentElement.appendChild(style);
	}

	function ensureSticker() {
		let root = document.getElementById(STICKER_ID);
		if (root) return root;
		root = document.createElement('div');
		root.id = STICKER_ID;
		root.className = HIDE_CLASS;
		root.innerHTML = `
			<div class="card">
				<div class="time" id="lapse-sticker-time">00:00</div>
			</div>
		`;
		document.documentElement.appendChild(root);
		// No interactions; purely display-only
		return root;
	}

	function formatTime(totalSeconds) {
		const minutes = Math.floor((totalSeconds || 0) / 60);
		const seconds = Math.max(0, (totalSeconds || 0) % 60);
		return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
	}

	let latestState = null;
	let localTick = null;

    function syncUI(state) {
		latestState = state;
		const root = ensureSticker();
		const timeEl = root.querySelector('#lapse-sticker-time');

        // Respect global sticker enable setting (stored in sync)
        // Show sticker ONLY while timer is running (not paused)
		let show = false;
        try {
            // Must be enabled AND actively running
            const enabled = (window.__lapseStickerEnabled !== false);
            const running = !!(state && state.isRunning && !state.isPaused);
            show = enabled && running;
        } catch (_) {
            // If we cannot read the flag, default to hiding unless we know it's running
            show = !!(state && state.isRunning && !state.isPaused);
        }
		root.classList.toggle(HIDE_CLASS, !show);

		// Populate UI with available info or defaults when no state
		const minutesText = state ? formatTime(state.currentTime) : '00:00';
		timeEl.textContent = minutesText;

		// Match theme via dark mode flag
		try { root.classList.toggle('dark', window.__lapseDarkMode === true); } catch (_) {}

        // Manage local ticking to keep display feeling live between background polls
		if (localTick) { clearInterval(localTick); localTick = null; }
        if (state && state.isRunning && !state.isPaused) {
			localTick = setInterval(() => {
				if (!latestState) return;
				latestState.currentTime = Math.max(0, (latestState.currentTime || 0) - 1);
				timeEl.textContent = formatTime(latestState.currentTime);
				if (latestState.currentTime === 0) {
					clearInterval(localTick); localTick = null;
				}
			}, 1000);
		}
	}

	async function fetchStateAndSync() {
		// Prefer asking the background (it computes remaining time)
		try {
			const state = await new Promise((resolve) => {
				chrome.runtime.sendMessage({ action: 'getState' }, resolve);
			});
			if (state) {
				syncUI(state);
				return;
			}
		} catch (_) {
			// fall through to storage fallback
		}

		// Fallback: read stored state directly
		try {
			const result = await chrome.storage.local.get(['pomodoroState']);
			syncUI(result && result.pomodoroState ? result.pomodoroState : null);
		} catch (_) {
			const root = ensureSticker();
			root.classList.add(HIDE_CLASS);
		}
	}

    function listenForStorageChanges() {
		try {
            chrome.storage.onChanged.addListener((changes, area) => {
				if (area !== 'local') return;
				if (changes.pomodoroState) {
					// The background maintains canonical state
					fetchStateAndSync();
				}
			});
		} catch (_) { /* no-op */ }
	}

    // Load sticker enabled flag and dark mode initially; listen for changes in sync storage
    (async function initStickerFlag() {
        try {
            const res = await chrome.storage.sync.get(['stickerEnabled', 'darkMode']);
            // If not set, default to true so sticker shows everywhere by default
            window.__lapseStickerEnabled = (res && typeof res.stickerEnabled !== 'undefined') ? (res.stickerEnabled === true) : true;
            window.__lapseDarkMode = !!(res && res.darkMode === true);
        } catch (_) { window.__lapseStickerEnabled = true; window.__lapseDarkMode = false; }
        try {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'sync' && changes.stickerEnabled) {
                    window.__lapseStickerEnabled = changes.stickerEnabled.newValue === true;
                    // Re-evaluate visibility with latest known state
                    syncUI(latestState);
                }
                if (area === 'sync' && changes.darkMode) {
                    window.__lapseDarkMode = changes.darkMode.newValue === true;
                    syncUI(latestState);
                }
            });
        } catch (_) {}
    })();

	createStyles();
	ensureSticker();
	fetchStateAndSync();
	listenForStorageChanges();

	// Also poll as a fallback in case messages are missed
	setInterval(fetchStateAndSync, 3000);
})();


