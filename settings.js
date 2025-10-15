class SettingsManager {
    constructor() {
        this.defaultSettings = {
            focusMinutes: 25,
            breakMinutes: 5,
            totalSessions: 4,
            notificationsEnabled: false,
            autoStartNext: false,
            resetOnComplete: true,
            darkMode: false
        };

        this.initializeElements();
        this.bindEvents();
        this.loadSettings();
    }

    initializeElements() {
        // Form elements
        this.settingsForm = document.getElementById('settingsForm');
        this.backBtn = document.getElementById('backBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.statusMessage = document.getElementById('statusMessage');

        // Timer duration inputs
        this.focusMinutesInput = document.getElementById('focusMinutes');
        this.breakMinutesInput = document.getElementById('breakMinutes');
        this.totalSessionsInput = document.getElementById('totalSessions');

		// Toggle switches
        this.notificationToggle = document.getElementById('notificationToggle');
        this.autoStartToggle = document.getElementById('autoStartToggle');
        this.resetOnCompleteToggle = document.getElementById('resetOnCompleteToggle');
        this.darkModeToggle = document.getElementById('darkModeToggle');

		// Wheel picker elements
		this.pickerBackdrop = document.getElementById('pickerBackdrop');
		this.wheelList = document.getElementById('wheelList');
		this.wheelArea = document.querySelector('.wheel-area');
		this.pickerCancelBtn = document.getElementById('pickerCancelBtn');
		this.pickerDoneBtn = document.getElementById('pickerDoneBtn');
		this.wheelUnit = document.getElementById('wheelUnit');
		this.pickerTitle = document.getElementById('pickerTitle');

		// Runtime state for picker
		this.activePicker = {
			input: null,
			min: 0,
			max: 0,
			unit: 'minutes',
			title: 'Select',
			selected: 0
		};
    }

    bindEvents() {
        // Back button
        this.backBtn.addEventListener('click', () => this.goBack());

        // Form submission
        this.settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSettings();
        });

		// Reset button
        this.resetBtn.addEventListener('click', () => this.resetToDefaults());

        // Toggle switches
        this.notificationToggle.addEventListener('click', () => this.toggleSwitch(this.notificationToggle));
        this.autoStartToggle.addEventListener('click', () => this.toggleSwitch(this.autoStartToggle));
        this.resetOnCompleteToggle.addEventListener('click', () => this.toggleSwitch(this.resetOnCompleteToggle));
        this.darkModeToggle.addEventListener('click', () => this.toggleDarkMode());

		// Input validation
        this.focusMinutesInput.addEventListener('input', () => this.validateInput(this.focusMinutesInput, 1, 60));
        this.breakMinutesInput.addEventListener('input', () => this.validateInput(this.breakMinutesInput, 1, 30));
        this.totalSessionsInput.addEventListener('input', () => this.validateInput(this.totalSessionsInput, 2, 10));

		// Open wheel picker on click/focus for nicer UX
		const openOn = ['click', 'focus'];
		openOn.forEach((evt) => {
            this.focusMinutesInput.addEventListener(evt, () => this.openPickerForInput(this.focusMinutesInput, 1, 60, 'minutes', 'Focus Session'));
            this.breakMinutesInput.addEventListener(evt, () => this.openPickerForInput(this.breakMinutesInput, 1, 30, 'minutes', 'Break'));
            this.totalSessionsInput.addEventListener(evt, () => this.openPickerForInput(this.totalSessionsInput, 2, 10, '', 'Session per Cycle'));
		});

		// Block direct typing and scroll on value fields (wheel-only)
		const blockDirectEdit = (el) => {
			el.setAttribute('readonly', 'readonly');
			el.addEventListener('keydown', (e) => {
				e.preventDefault();
				return false;
			});
			el.addEventListener('wheel', (e) => {
				e.preventDefault();
			});
			el.addEventListener('paste', (e) => e.preventDefault());
		};
        [ this.focusMinutesInput, this.breakMinutesInput, this.totalSessionsInput ].forEach(blockDirectEdit);

		// Picker controls
		this.pickerCancelBtn.addEventListener('click', () => this.closePicker(false));
		this.pickerDoneBtn.addEventListener('click', () => this.closePicker(true));
		this.pickerBackdrop.addEventListener('click', (e) => {
			if (e.target === this.pickerBackdrop) this.closePicker(false);
		});
    }

	// Build the wheel with given range and initial value
	buildWheel(min, max, currentValue) {
		// Clear list
		this.wheelList.innerHTML = '';

		// Tentative dimensions (fallbacks)
		let itemHeight = 36; // CSS target
		let containerHeight = this.wheelArea ? this.wheelArea.getBoundingClientRect().height : 180;
		if (!containerHeight || containerHeight < itemHeight) containerHeight = 180;
		const spacerPx = Math.max(0, Math.round((containerHeight - itemHeight) / 2));

		// Create dynamic top spacer so first item can center exactly
		const extraRows = 2; // keep 2 number spaces on
		const spacerTop = document.createElement('div');
		spacerTop.style.height = (spacerPx + extraRows * itemHeight) + 'px';
		spacerTop.setAttribute('aria-hidden', 'true');
		this.wheelList.appendChild(spacerTop);

		for (let i = min; i <= max; i++) {
			const item = document.createElement('div');
			item.className = 'wheel-item';
			item.textContent = String(i);
			item.setAttribute('data-value', String(i));
			this.wheelList.appendChild(item);
		}

		// Measure actual item height if possible
		const firstRealItem = this.wheelList.querySelector('.wheel-item');
		if (firstRealItem) {
			const h = firstRealItem.getBoundingClientRect().height;
			if (h && Number.isFinite(h)) itemHeight = h;
		}


		// Bottom spacer to allow last item to center
		const spacerBottom = document.createElement('div');
		spacerBottom.style.height = (spacerPx + extraRows * itemHeight) + 'px';
		spacerBottom.setAttribute('aria-hidden', 'true');
		this.wheelList.appendChild(spacerBottom);

		// Persist measured dims for handlers
		this.activePicker.itemHeight = itemHeight;
		this.activePicker.spacerPx = spacerPx;
		this.activePicker.extraRows = extraRows;

		// Scroll to current value
		const clamped = Math.min(Math.max(currentValue, min), max);
		const targetTop = (spacerPx + extraRows * itemHeight) + (clamped - min) * itemHeight;
		this.wheelList.scrollTo({ top: targetTop, behavior: 'instant' });

		// Attach scroll snapping with selection update
		let scrollTimeout = null;
		this.wheelList.onscroll = () => {
			if (scrollTimeout) clearTimeout(scrollTimeout);
			scrollTimeout = setTimeout(() => {
				// Find the item visually closest to the center line
				const centerY = this.wheelArea.getBoundingClientRect().top + (this.wheelArea.getBoundingClientRect().height / 2);
				const items = Array.from(this.wheelList.querySelectorAll('.wheel-item[data-value]'));
				let nearest = null;
				let nearestDelta = Infinity;
				for (const el of items) {
					const r = el.getBoundingClientRect();
					const mid = r.top + r.height / 2;
					const d = Math.abs(mid - centerY);
					if (d < nearestDelta) { nearestDelta = d; nearest = el; }
				}
				if (nearest) {
					const r = nearest.getBoundingClientRect();
					const mid = r.top + r.height / 2;
					const delta = mid - centerY; // positive if item center is below center line
					const targetTop = this.wheelList.scrollTop + delta;
					this.wheelList.scrollTo({ top: targetTop, behavior: 'smooth' });
					const value = Number(nearest.getAttribute('data-value'));
					if (Number.isFinite(value)) {
						this.activePicker.selected = value;
						// Live-sync the visible field so wheel stays on what display shows
						if (this.activePicker.input) this.activePicker.input.value = String(value);
					}
				}
			}, 120);
		};

		// Allow clicking an item to select
		this.wheelList.addEventListener('click', (e) => {
			const item = e.target.closest('.wheel-item');
			if (!item) return;
			const value = Number(item.getAttribute('data-value'));
			if (!Number.isFinite(value)) return;
			this.activePicker.selected = value;
			if (this.activePicker.input) this.activePicker.input.value = String(value);
			const centerY = this.wheelArea.getBoundingClientRect().top + (this.wheelArea.getBoundingClientRect().height / 2);
			const r = item.getBoundingClientRect();
			const mid = r.top + r.height / 2;
			const delta = mid - centerY;
			const targetTop = this.wheelList.scrollTop + delta;
			this.wheelList.scrollTo({ top: targetTop, behavior: 'smooth' });
		});
	}

	openPickerForInput(input, min, max, unit, title) {
		// Initialize state
		this.activePicker.input = input;
		this.activePicker.min = min;
		this.activePicker.max = max;
		this.activePicker.unit = unit;
		this.activePicker.title = title;
		this.activePicker.selected = parseInt(input.value) || min;

		// Update UI
		this.pickerTitle.textContent = title;
		this.wheelUnit.textContent = unit;

		// Show modal first to ensure correct measurements
		this.pickerBackdrop.classList.add('show');
		this.pickerBackdrop.setAttribute('aria-hidden', 'false');
		// Wait a frame for layout, then build
		requestAnimationFrame(() => {
			this.buildWheel(min, max, this.activePicker.selected);
		});
	}

	closePicker(commit) {
		if (commit && this.activePicker.input) {
			this.activePicker.input.value = String(this.activePicker.selected);
			// Also run validation to clamp and keep logic consistent
			this.validateInput(this.activePicker.input, this.activePicker.min, this.activePicker.max);
		}

		this.pickerBackdrop.classList.remove('show');
		this.pickerBackdrop.setAttribute('aria-hidden', 'true');
		this.activePicker.input = null;
	}

    validateInput(input, min, max) {
        let value = parseInt(input.value);
        if (isNaN(value) || value < min) {
            input.value = min;
        } else if (value > max) {
            input.value = max;
        }
    }

    toggleSwitch(toggleElement) {
        toggleElement.classList.toggle('active');
    }

    toggleDarkMode() {
        this.darkModeToggle.classList.toggle('active');
        const isDarkMode = this.darkModeToggle.classList.contains('active');
        document.body.classList.toggle('dark-mode', isDarkMode);
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get(Object.keys(this.defaultSettings));
            const settings = { ...this.defaultSettings, ...result };

            // Update form inputs
            this.focusMinutesInput.value = settings.focusMinutes;
            this.breakMinutesInput.value = settings.breakMinutes;
            this.totalSessionsInput.value = settings.totalSessions;

            // Update toggle switches
            this.updateToggleSwitch(this.notificationToggle, settings.notificationsEnabled);
            this.updateToggleSwitch(this.autoStartToggle, settings.autoStartNext);
            this.updateToggleSwitch(this.resetOnCompleteToggle, settings.resetOnComplete);
            this.updateToggleSwitch(this.darkModeToggle, settings.darkMode);

            // Apply dark mode immediately
            document.body.classList.toggle('dark-mode', settings.darkMode);

            console.log('Settings loaded:', settings);
        } catch (error) {
            console.error('Error loading settings:', error);
            this.showStatusMessage('Error loading settings', 'error');
        }
    }

    updateToggleSwitch(toggleElement, isActive) {
        if (isActive) {
            toggleElement.classList.add('active');
        } else {
            toggleElement.classList.remove('active');
        }
    }

    async saveSettings() {
        try {
            const settings = {
                focusMinutes: parseInt(this.focusMinutesInput.value),
                breakMinutes: parseInt(this.breakMinutesInput.value),
                totalSessions: parseInt(this.totalSessionsInput.value),
                notificationsEnabled: this.notificationToggle.classList.contains('active'),
                autoStartNext: this.autoStartToggle.classList.contains('active'),
                resetOnComplete: this.resetOnCompleteToggle.classList.contains('active'),
                darkMode: this.darkModeToggle.classList.contains('active')
            };

            // Validate settings
            if (settings.focusMinutes < 1 || settings.focusMinutes > 60) {
                this.showStatusMessage('Focus minutes must be between 1 and 60', 'error');
                return;
            }
            if (settings.breakMinutes < 1 || settings.breakMinutes > 30) {
                this.showStatusMessage('Break minutes must be between 1 and 30', 'error');
                return;
            }
            
            if (settings.totalSessions < 2 || settings.totalSessions > 10) {
                this.showStatusMessage('Total sessions must be between 2 and 10', 'error');
                return;
            }

            // Save to Chrome storage
            await chrome.storage.sync.set(settings);

            // Notify background script about settings change
            try {
                chrome.runtime.sendMessage({
                    action: 'settingsUpdated',
                    settings: settings
                });
            } catch (error) {
                console.log('Background script not available for settings update');
            }

            this.showStatusMessage('Settings saved successfully!', 'success');
            console.log('Settings saved:', settings);

            // Auto-close after successful save (optional)
            setTimeout(() => {
                this.goBack();
            }, 1500);

        } catch (error) {
            console.error('Error saving settings:', error);
            this.showStatusMessage('Error saving settings', 'error');
        }
    }

    async resetToDefaults() {
        if (confirm('Are you sure you want to reset all settings to defaults?')) {
            try {
                // Clear all settings
                await chrome.storage.sync.clear();

                // Reset form to defaults
                this.focusMinutesInput.value = this.defaultSettings.focusMinutes;
                this.breakMinutesInput.value = this.defaultSettings.breakMinutes;
                this.totalSessionsInput.value = this.defaultSettings.totalSessions;

                this.updateToggleSwitch(this.notificationToggle, this.defaultSettings.notificationsEnabled);
                this.updateToggleSwitch(this.autoStartToggle, this.defaultSettings.autoStartNext);
                this.updateToggleSwitch(this.resetOnCompleteToggle, this.defaultSettings.resetOnComplete);
                this.updateToggleSwitch(this.darkModeToggle, this.defaultSettings.darkMode);

                // Apply dark mode immediately
                document.body.classList.toggle('dark-mode', this.defaultSettings.darkMode);

                this.showStatusMessage('Settings reset to defaults', 'success');
                console.log('Settings reset to defaults');

            } catch (error) {
                console.error('Error resetting settings:', error);
                this.showStatusMessage('Error resetting settings', 'error');
            }
        }
    }

    showStatusMessage(message, type) {
        this.statusMessage.textContent = message;
        this.statusMessage.className = `status-message ${type} show`;

        // Hide message after 3 seconds
        setTimeout(() => {
            this.statusMessage.classList.remove('show');
        }, 3000);
    }

    goBack() {
        // Try to close the settings window and return to popup
        if (window.opener) {
            window.close();
        } else {
            // If opened in new tab, navigate back to popup
            window.location.href = chrome.runtime.getURL('popup.html');
        }
    }
}

// Initialize settings manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Settings page initializing...');
    try {
        new SettingsManager();
        console.log('Settings manager initialized successfully');
    } catch (error) {
        console.error('Error initializing settings manager:', error);
    }
});
