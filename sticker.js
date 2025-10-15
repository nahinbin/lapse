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
		// Make draggable
		makeDraggable(root);
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
        // If enabled, show sticker even if timer is not running; otherwise only show when running
		let show = false;
        try {
            // We'll read sync flag quickly and cache decision via closure; this is fast and tiny
            // Note: using async here would complicate flow; read from cache updated by listener below
			// Default to showing when the user hasn't explicitly disabled the sticker
			show = (window.__lapseStickerEnabled !== false) || (state && state.isRunning && !state.isPaused);
        } catch (_) {
			// If we cannot read the flag, prefer showing so the user sees the control
			show = true;
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

	// ---- Draggable + Position Persistence ----
	let dragState = null;

	function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }

	function getStickerRect(root) {
		const r = root.getBoundingClientRect();
		return { width: r.width || 120, height: r.height || 40 };
	}

	function applySavedPosition(root, pos) {
		if (!pos || typeof pos.left !== 'number' || typeof pos.top !== 'number') return;
		root.style.left = pos.left + 'px';
		root.style.top = pos.top + 'px';
		root.style.right = 'auto';
		root.style.bottom = 'auto';
	}

	function clampAndApply(root) {
		const rect = getStickerRect(root);
		const maxLeft = Math.max(0, (window.innerWidth || 0) - rect.width - 8);
		const maxTop = Math.max(0, (window.innerHeight || 0) - rect.height - 8);
		const left = parseFloat(root.style.left || '');
		const top = parseFloat(root.style.top || '');
		if (Number.isFinite(left) && Number.isFinite(top)) {
			const clampedLeft = clamp(left, 8, maxLeft);
			const clampedTop = clamp(top, 8, maxTop);
			root.style.left = clampedLeft + 'px';
			root.style.top = clampedTop + 'px';
		}
	}

	function savePositionDebounced(left, top) {
		if (savePositionDebounced.t) clearTimeout(savePositionDebounced.t);
		savePositionDebounced.t = setTimeout(() => {
			try { chrome.storage.sync.set({ stickerPosition: { left, top } }); } catch (_) {}
		}, 120);
	}

	async function loadAndApplyPosition(root) {
		try {
			const res = await chrome.storage.sync.get(['stickerPosition']);
			if (res && res.stickerPosition) {
				applySavedPosition(root, res.stickerPosition);
				clampAndApply(root);
			}
		} catch (_) { /* ignore */ }
	}

	function makeDraggable(root) {
		const handle = root.querySelector('.card') || root;
		const onPointerDown = (e) => {
			const isTouch = e.type === 'touchstart';
			const point = isTouch ? e.touches[0] : e;
			const rect = root.getBoundingClientRect();
			// Switch to left/top anchoring on first drag
			root.style.left = rect.left + 'px';
			root.style.top = rect.top + 'px';
			root.style.right = 'auto';
			root.style.bottom = 'auto';
			dragState = {
				offsetX: point.clientX - rect.left,
				offsetY: point.clientY - rect.top
			};
			document.addEventListener('mousemove', onPointerMove, { passive: false });
			document.addEventListener('mouseup', onPointerUp, { passive: true });
			document.addEventListener('touchmove', onPointerMove, { passive: false });
			document.addEventListener('touchend', onPointerUp, { passive: true });
			if (!isTouch) e.preventDefault();
		};

		const onPointerMove = (e) => {
			if (!dragState) return;
			const point = e.touches ? e.touches[0] : e;
			const rect = getStickerRect(root);
			const maxLeft = Math.max(0, (window.innerWidth || 0) - rect.width - 8);
			const maxTop = Math.max(0, (window.innerHeight || 0) - rect.height - 8);
			let left = (point.clientX - dragState.offsetX);
			let top = (point.clientY - dragState.offsetY);
			left = clamp(left, 8, maxLeft);
			top = clamp(top, 8, maxTop);
			root.style.left = left + 'px';
			root.style.top = top + 'px';
			savePositionDebounced(left, top);
			e.preventDefault();
		};

		const onPointerUp = () => {
			dragState = null;
			document.removeEventListener('mousemove', onPointerMove);
			document.removeEventListener('mouseup', onPointerUp);
			document.removeEventListener('touchmove', onPointerMove);
			document.removeEventListener('touchend', onPointerUp);
		};

		handle.addEventListener('mousedown', onPointerDown);
		handle.addEventListener('touchstart', onPointerDown, { passive: false });

		// Apply saved position on creation
		loadAndApplyPosition(root);
		// Keep in view on resize
		window.addEventListener('resize', () => clampAndApply(root));
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
        } catch (_) { window.__lapseStickerEnabled = false; window.__lapseDarkMode = false; }
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


