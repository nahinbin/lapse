class PomodoroTimer {
    constructor() {
        this.isRunning = false;
        this.isPaused = false;
        this.currentTime = 25 * 60; // 25 minutes in seconds
        this.sessionNumber = 1;
        this.totalSessions = 4;
        this.mode = 'focus'; // 'focus', 'break', 'long-break'
        
        // Default timer durations (in seconds)
        this.durations = {
            focus: 25 * 60,
            break: 5 * 60,
            longBreak: 15 * 60
        };

        // Settings
        this.settings = {
            notificationsEnabled: false,
            autoStartNext: false,
            resetOnComplete: true,
            darkMode: false
        };
        
        this.initializeElements();
        this.bindEvents();
        this.loadSettings();
        this.loadState();
        this.updateDisplay();
        this.setupSettingsListener();
        
        // Also load settings on window focus (when popup reopens)
        window.addEventListener('focus', () => {
            console.log('Window focused, reloading settings...');
            this.loadSettings();
        });
    }
    
    initializeElements() {
        this.timeElement = document.getElementById('time');
        this.progressFill = document.getElementById('progressFill');
        this.startBtn = document.getElementById('startBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.sessionNumberElement = document.getElementById('sessionNumber');
        this.controlsElement = document.querySelector('.controls');
        this.expandBtn = document.getElementById('expandBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        
        // Debug: Check if all elements are found
        console.log('Elements found:', {
            timeElement: !!this.timeElement,
            progressFill: !!this.progressFill,
            startBtn: !!this.startBtn,
            resetBtn: !!this.resetBtn,
            sessionNumberElement: !!this.sessionNumberElement,
            controlsElement: !!this.controlsElement,
            expandBtn: !!this.expandBtn,
            settingsBtn: !!this.settingsBtn
        });
        
        // If any critical elements are missing, try again after a short delay
        if (!this.timeElement || !this.startBtn || !this.sessionNumberElement || !this.settingsBtn) {
            console.log('Some elements not found, retrying...');
            setTimeout(() => {
                this.timeElement = document.getElementById('time');
                this.progressFill = document.getElementById('progressFill');
                this.startBtn = document.getElementById('startBtn');
                this.resetBtn = document.getElementById('resetBtn');
                this.sessionNumberElement = document.getElementById('sessionNumber');
                this.controlsElement = document.querySelector('.controls');
                this.expandBtn = document.getElementById('expandBtn');
                this.settingsBtn = document.getElementById('settingsBtn');
                
                console.log('Retry - Elements found:', {
                    timeElement: !!this.timeElement,
                    progressFill: !!this.progressFill,
                    startBtn: !!this.startBtn,
                    resetBtn: !!this.resetBtn,
                    sessionNumberElement: !!this.sessionNumberElement,
                    controlsElement: !!this.controlsElement,
                    expandBtn: !!this.expandBtn,
                    settingsBtn: !!this.settingsBtn
                });
                
                // Re-bind events if elements are now found
                if (this.startBtn && this.resetBtn && this.settingsBtn) {
                    this.bindEvents();
                }
            }, 200);
        }
    }
    
    bindEvents() {
        this.startBtn.addEventListener('click', () => this.toggleTimer());
        this.resetBtn.addEventListener('click', () => this.resetTimer());
        
        // Add expand button event listener if it exists
        if (this.expandBtn) {
            this.expandBtn.addEventListener('click', () => this.expandToFullscreen());
        }
        
        // Add settings button event listener if it exists
        if (this.settingsBtn) {
            console.log('Attaching settings button event listener');
            this.settingsBtn.addEventListener('click', () => this.openSettings());
        } else {
            console.log('Settings button not found - cannot attach event listener');
        }
    }
    
    expandToFullscreen() {
        // Open fullscreen window
        const fullscreenWindow = window.open(
            chrome.runtime.getURL('fullscreen.html'),
            'lapse-fullscreen',
            'width=800,height=600,resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no'
        );
        
        // Focus the new window
        if (fullscreenWindow) {
            fullscreenWindow.focus();
        }
    }
    
    openSettings() {
        console.log('Settings button clicked - opening settings page');
        // Open settings page in a new window
        const settingsWindow = window.open(
            chrome.runtime.getURL('settings.html'),
            'lapse-settings',
            'width=500,height=700,resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no'
        );
        
        // Focus the new window
        if (settingsWindow) {
            settingsWindow.focus();
        }
    }
    
    updateButtonLayout() {
        // Show reset button and change layout only when timer is actively running
        if (this.isRunning && !this.isPaused) {
            // Add a small delay to make the reset button reveal more dramatic
            setTimeout(() => {
                this.resetBtn.classList.remove('hidden');
                this.controlsElement.classList.remove('centered');
                this.controlsElement.classList.add('split');
            }, 200);
        } else {
            // Hide reset button and center start button when timer is stopped or paused
            this.resetBtn.classList.add('hidden');
            this.controlsElement.classList.remove('split');
            this.controlsElement.classList.add('centered');
        }
    }
    
    toggleTimer() {
        console.log('Toggle timer clicked, isRunning:', this.isRunning);
        if (this.isRunning) {
            this.pauseTimer();
        } else {
            this.startTimer();
        }
    }
    
    startTimer() {
        console.log('Starting timer...');
        this.isRunning = true;
        this.isPaused = false;
        
        // If timer was reset or just started, use the full duration for current mode
        if (this.currentTime === this.durations[this.mode]) {
            console.log(`Starting fresh ${this.mode} session: ${this.currentTime} seconds`);
        }
        
        // Add a subtle animation when changing to pause icon
        this.startBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            this.startBtn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
            `;
            this.startBtn.style.transform = 'scale(1)';
        }, 100);
        
        this.startBtn.classList.add('paused');
        
        this.updateButtonLayout();
        
        // Try to send message to background script, but don't fail if it doesn't work
        try {
            chrome.runtime.sendMessage({
                action: 'startTimer',
                currentTime: this.currentTime,
                state: {
                    isRunning: this.isRunning,
                    isPaused: this.isPaused,
                    currentTime: this.currentTime,
                    sessionNumber: this.sessionNumber,
                    mode: this.mode
                }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('Background script not available, using local timer');
                } else {
                    console.log('Background script response:', response);
                }
            });
        } catch (error) {
            console.log('Background script not available, using local timer');
        }
        
        // Start local display update
        this.startLocalTimer();
        console.log('Timer started successfully');
    }
    
    startLocalTimer() {
        this.localInterval = setInterval(() => {
            if (this.currentTime > 0) {
                this.currentTime--;
                this.updateDisplay();
            } else {
                this.completeSession();
            }
        }, 1000);
    }
    
    stopLocalTimer() {
        if (this.localInterval) {
            clearInterval(this.localInterval);
            this.localInterval = null;
        }
    }
    
    pauseTimer() {
        this.isRunning = false;
        this.isPaused = true;
        this.startBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
            </svg>
        `;
        this.startBtn.classList.remove('paused');
        
        this.updateButtonLayout();
        
        // Try to send message to background script
        try {
            chrome.runtime.sendMessage({
                action: 'pauseTimer',
                state: {
                    isRunning: this.isRunning,
                    isPaused: this.isPaused,
                    currentTime: this.currentTime,
                    sessionNumber: this.sessionNumber,
                    mode: this.mode
                }
            });
        } catch (error) {
            console.log('Background script not available');
        }
        
        this.stopLocalTimer();
    }
    
    resetTimer() {
        this.isRunning = false;
        this.isPaused = false;
        this.startBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
            </svg>
        `;
        this.startBtn.classList.remove('paused');
        
        this.updateButtonLayout();
        
        // Reset to current mode's duration
        this.currentTime = this.durations[this.mode];
        
        // Try to send message to background script
        try {
            chrome.runtime.sendMessage({
                action: 'resetTimer',
                state: {
                    isRunning: this.isRunning,
                    isPaused: this.isPaused,
                    currentTime: this.currentTime,
                    sessionNumber: this.sessionNumber,
                    mode: this.mode
                }
            });
        } catch (error) {
            console.log('Background script not available');
        }
        
        this.stopLocalTimer();
        this.updateDisplay();
    }
    
    startDisplayUpdate() {
        this.displayInterval = setInterval(() => {
            this.updateDisplayFromBackground();
        }, 1000);
    }
    
    stopDisplayUpdate() {
        if (this.displayInterval) {
            clearInterval(this.displayInterval);
            this.displayInterval = null;
        }
    }
    
    async updateDisplayFromBackground() {
        try {
            const state = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ action: 'getState' }, resolve);
            });
            
            if (state) {
                this.currentTime = state.currentTime;
                this.sessionNumber = state.sessionNumber;
                this.mode = state.mode;
                this.isRunning = state.isRunning;
                this.isPaused = state.isPaused;
                
                this.updateDisplay();
                
                // If timer completed while popup was closed
                if (!this.isRunning && !this.isPaused && this.currentTime === 0) {
                    this.completeSession();
                }
            }
        } catch (error) {
            console.log('Error updating display from background:', error);
        }
    }
    
    tick() {
        if (this.currentTime > 0) {
            this.currentTime--;
            this.updateDisplay();
        } else {
            this.completeSession();
        }
    }
    
    completeSession() {
        this.isRunning = false;
        this.startBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
            </svg>
        `;
        this.startBtn.classList.remove('paused');
        
        this.updateButtonLayout();
        
        this.stopLocalTimer();
        
        // Play notification sound (if available)
        this.playNotification();
        
        // Move to next session
        this.nextSession();
    }
    
    nextSession() {
        if (this.mode === 'focus') {
            this.sessionNumber++;
            if (this.sessionNumber <= this.totalSessions) {
                // Short break after focus session
                this.mode = 'break';
                this.currentTime = this.durations.break;
            } else {
                // Long break after all focus sessions
                this.mode = 'long-break';
                this.currentTime = this.durations.longBreak;
                this.sessionNumber = 1; // Reset for next cycle
            }
        } else {
            // After break, go back to focus
            this.mode = 'focus';
            this.currentTime = this.durations.focus;
        }
        
        this.updateDisplay();
        
        // Auto-start next session if enabled
        if (this.settings.autoStartNext) {
            setTimeout(() => {
                this.startTimer();
            }, 2000); // 2 second delay to allow user to see the transition
        }
    }
    
    updateDisplay() {
        console.log('updateDisplay called, elements:', {
            timeElement: !!this.timeElement,
            progressFill: !!this.progressFill,
            sessionNumberElement: !!this.sessionNumberElement
        });
        
        // Update time display
        const minutes = Math.floor(this.currentTime / 60);
        const seconds = this.currentTime % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // No animations - instant updates
        if (this.timeElement) {
            this.timeElement.textContent = timeString;
        } else {
            console.error('timeElement is null!');
        }
        
        // Update progress bar
        if (this.progressFill) {
            const totalDuration = this.durations[this.mode];
            const progress = ((totalDuration - this.currentTime) / totalDuration) * 100;
            this.progressFill.style.width = `${progress}%`;
        } else {
            console.error('progressFill is null!');
        }
        
        // Update session number
        if (this.sessionNumberElement) {
            this.sessionNumberElement.textContent = this.sessionNumber;
        } else {
            console.error('sessionNumberElement is null!');
        }
    }
    
    playNotification() {
        // Play sound notification if enabled
        if (this.settings.notificationsEnabled) {
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
                
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
            } catch (error) {
                console.log('Audio notification not available');
            }
        }

        // Show browser notification if enabled
        if (this.settings.notificationsEnabled) {
            this.showBrowserNotification();
        }
    }

    async showBrowserNotification() {
        try {
            // Request notification permission if not already granted
            if (Notification.permission === 'default') {
                await Notification.requestPermission();
            }

            if (Notification.permission === 'granted') {
                const title = this.mode === 'focus' ? 'Focus Session Complete!' : 'Break Time!';
                const body = this.mode === 'focus' 
                    ? 'Time for a break. Great work!'
                    : 'Break is over. Ready to focus?';
                
                const notification = new Notification(title, {
                    body: body,
                    icon: chrome.runtime.getURL('icons/icon48.png'),
                    badge: chrome.runtime.getURL('icons/icon32.png'),
                    tag: 'pomodoro-timer',
                    requireInteraction: false
                });

                // Auto-close notification after 5 seconds
                setTimeout(() => {
                    notification.close();
                }, 5000);
            }
        } catch (error) {
            console.log('Browser notification not available:', error);
        }
    }
    
    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get([
                'focusMinutes', 'breakMinutes', 'longBreakMinutes', 'totalSessions',
                'notificationsEnabled', 'autoStartNext', 'resetOnComplete', 'darkMode'
            ]);
            
            // Update timer durations
            if (result.focusMinutes) {
                this.durations.focus = result.focusMinutes * 60;
            }
            if (result.breakMinutes) {
                this.durations.break = result.breakMinutes * 60;
            }
            if (result.longBreakMinutes) {
                this.durations.longBreak = result.longBreakMinutes * 60;
            }
            if (result.totalSessions) {
                this.totalSessions = result.totalSessions;
            }
            
            // Update settings
            this.settings.notificationsEnabled = result.notificationsEnabled !== undefined ? result.notificationsEnabled : false;
            this.settings.autoStartNext = result.autoStartNext !== undefined ? result.autoStartNext : false;
            this.settings.resetOnComplete = result.resetOnComplete !== undefined ? result.resetOnComplete : true;
            this.settings.darkMode = result.darkMode !== undefined ? result.darkMode : false;

            // Apply dark mode theme
            document.body.classList.toggle('dark-mode', this.settings.darkMode);
            console.log('Dark mode applied:', this.settings.darkMode);
            
            // Update current time if it matches the old duration
            if (this.currentTime === 25 * 60 && this.mode === 'focus') {
                this.currentTime = this.durations.focus;
            }
            
            console.log('Settings loaded:', {
                durations: this.durations,
                totalSessions: this.totalSessions,
                settings: this.settings
            });
        } catch (error) {
            console.log('Error loading settings, using defaults:', error);
        }
    }

    async loadState() {
        console.log('Loading state from background script...');
        
        // Try to load from background script, but don't fail if it doesn't work
        try {
            const state = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ action: 'getState' }, resolve);
            });
            
            if (state) {
                console.log('Loaded state from background:', state);
                this.isRunning = state.isRunning || false;
                this.isPaused = state.isPaused || false;
                this.currentTime = state.currentTime || this.durations[this.mode];
                this.sessionNumber = state.sessionNumber || 1;
                this.mode = state.mode || 'focus';
                
                // If timer was running, resume display updates
                if (this.isRunning && !this.isPaused) {
                    console.log('Timer was running, resuming...');
                    this.startBtn.innerHTML = `
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                        </svg>
                    `;
                    this.startBtn.classList.add('paused');
                    this.startLocalTimer();
                } else if (this.isPaused) {
                    console.log('Timer was paused');
                    this.startBtn.innerHTML = `
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    `;
                } else {
                    console.log('Timer was stopped');
                }
                
                this.updateDisplay();
                this.updateButtonLayout();
            } else {
                console.log('No state found, using default state');
                this.updateDisplay();
                this.updateButtonLayout();
            }
        } catch (error) {
            console.log('Background script not available, using default state:', error);
            this.updateDisplay();
            this.updateButtonLayout();
        }
    }

    setupSettingsListener() {
        // Listen for settings updates from the settings page
        try {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                if (message.action === 'settingsUpdated') {
                    console.log('Settings updated message received, reloading...');
                    this.loadSettings();
                    this.updateDisplay();
                }
            });
        } catch (error) {
            console.log('Could not setup settings listener:', error);
        }
    }
}

// Initialize the timer when the popup loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Lapse timer initializing...');
    
    // Add a small delay to ensure DOM is fully ready
    setTimeout(() => {
        try {
            new PomodoroTimer();
            console.log('Lapse timer initialized successfully');
        } catch (error) {
            console.error('Error initializing Lapse timer:', error);
        }
    }, 100);
    
    // Also check settings after a longer delay to ensure they're loaded
    setTimeout(async () => {
        try {
            const result = await chrome.storage.sync.get(['darkMode']);
            if (result.darkMode !== undefined) {
                document.body.classList.toggle('dark-mode', result.darkMode);
                console.log('Dark mode applied on DOM load:', result.darkMode);
            }
        } catch (error) {
            console.log('Error loading dark mode on DOM load:', error);
        }
    }, 200);
});
