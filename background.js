// Background script for Lapse
// Handles timer persistence across browser restarts

class BackgroundTimer {
    constructor() {
        this.setupAlarmListener();
        this.loadInitialState();
        this.ensureInitialState();
    }

    setupAlarmListener() {
        chrome.alarms.onAlarm.addListener((alarm) => {
            if (alarm.name === 'pomodoro-timer') {
                this.handleTimerComplete();
            }
        });
    }

    async loadInitialState() {
        console.log('Loading initial state...');
        const result = await chrome.storage.local.get(['pomodoroState']);
        if (result.pomodoroState) {
            const state = result.pomodoroState;
            console.log('Found existing state:', state);
            
            if (state.isRunning && !state.isPaused && state.startTime) {
                // Calculate remaining time based on elapsed time since start
                const now = Date.now();
                const elapsed = Math.floor((now - state.startTime) / 1000);
                const remaining = Math.max(0, state.currentTime - elapsed);
                
                console.log(`Timer was running. Elapsed: ${elapsed}s, Remaining: ${remaining}s`);
                
                if (remaining > 0) {
                    // Update state with remaining time and new start time
                    const updatedState = {
                        ...state,
                        currentTime: remaining,
                        startTime: now // Reset start time for accurate future calculations
                    };
                    
                    chrome.storage.local.set({ pomodoroState: updatedState });
                    
                    // Set alarm for remaining time (convert seconds to minutes)
                    chrome.alarms.create('pomodoro-timer', {
                        delayInMinutes: remaining / 60
                    });
                    
                    console.log(`Timer resumed: ${remaining} seconds remaining`);
                } else {
                    // Timer should have completed while browser was closed
                    console.log('Timer completed while browser was closed');
                    this.handleTimerComplete();
                }
            } else {
                console.log('Timer was not running or was paused');
            }
        } else {
            console.log('No existing state found');
        }
    }

    async ensureInitialState() {
        const result = await chrome.storage.local.get(['pomodoroState']);
        if (!result.pomodoroState) {
            // Set up initial state if none exists
            const initialState = {
                isRunning: false,
                isPaused: false,
                currentTime: 25 * 60, // 25 minutes in seconds
                sessionNumber: 1,
                mode: 'focus',
                startTime: null
            };
            chrome.storage.local.set({ pomodoroState: initialState });
            console.log('Initial state created');
        }
    }

    handleTimerComplete() {
        // Get current state
        chrome.storage.local.get(['pomodoroState'], (result) => {
            if (result.pomodoroState) {
                const state = result.pomodoroState;
                
                // Move to next session
                this.nextSession(state);
                
                // Show notification
                this.showNotification(state);
            }
        });
    }

    nextSession(state) {
        const durations = {
            focus: 25 * 60,
            break: 5 * 60,
            longBreak: 15 * 60
        };

        let newState = { ...state };

        if (state.mode === 'focus') {
            newState.sessionNumber++;
            if (newState.sessionNumber <= 4) {
                newState.mode = 'break';
                newState.currentTime = durations.break;
            } else {
                newState.mode = 'long-break';
                newState.currentTime = durations.longBreak;
                newState.sessionNumber = 1;
            }
        } else {
            newState.mode = 'focus';
            newState.currentTime = durations.focus;
        }

        newState.isRunning = false;
        newState.isPaused = false;
        newState.startTime = null;

        chrome.storage.local.set({ pomodoroState: newState });
    }

    showNotification(state) {
        const modeText = {
            'focus': 'Focus',
            'break': 'Break',
            'long-break': 'Long Break'
        };

        const icon48 = chrome.runtime.getURL('icons/icon48.png');
        chrome.notifications.create({
            type: 'basic',
            iconUrl: icon48,
            title: 'Lapse',
            message: `${modeText[state.mode]} session completed! Time for ${state.mode === 'focus' ? 'a break' : 'focus'}.`
        });
    }

    // Calculate current remaining time based on stored start time
    calculateRemainingTime(state) {
        if (!state.isRunning || state.isPaused || !state.startTime) {
            return state.currentTime;
        }

        const now = Date.now();
        const elapsed = Math.floor((now - state.startTime) / 1000);
        const remaining = Math.max(0, state.currentTime - elapsed);
        
        // If timer has expired, trigger completion
        if (remaining === 0 && state.isRunning && !state.isPaused) {
            this.handleTimerComplete();
        }
        
        return remaining;
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startTimer') {
        const { currentTime } = request;
        const startTime = Date.now();
        
        // Save state with start time
        chrome.storage.local.set({
            pomodoroState: {
                ...request.state,
                startTime: startTime,
                isRunning: true,
                isPaused: false
            }
        });

        // Set alarm
        chrome.alarms.create('pomodoro-timer', {
            delayInMinutes: currentTime / 60
        });

        sendResponse({ success: true });
    } else if (request.action === 'pauseTimer') {
        // Clear alarm
        chrome.alarms.clear('pomodoro-timer');
        
        // Calculate remaining time
        chrome.storage.local.get(['pomodoroState'], (result) => {
            if (result.pomodoroState) {
                const state = result.pomodoroState;
                const remaining = backgroundTimer.calculateRemainingTime(state);
                
                chrome.storage.local.set({
                    pomodoroState: {
                        ...state,
                        currentTime: remaining,
                        isRunning: false,
                        isPaused: true,
                        startTime: null
                    }
                });
            }
        });

        sendResponse({ success: true });
    } else if (request.action === 'resetTimer') {
        // Clear alarm
        chrome.alarms.clear('pomodoro-timer');
        
        // Reset state
        chrome.storage.local.set({
            pomodoroState: {
                ...request.state,
                isRunning: false,
                isPaused: false,
                startTime: null
            }
        });

        sendResponse({ success: true });
    } else if (request.action === 'getState') {
        chrome.storage.local.get(['pomodoroState'], (result) => {
            if (result.pomodoroState) {
                const state = result.pomodoroState;
                const remaining = backgroundTimer.calculateRemainingTime(state);
                
                sendResponse({
                    ...state,
                    currentTime: remaining
                });
            } else {
                sendResponse(null);
            }
        });
        return true; // Keep message channel open for async response
    }
});

// Initialize background timer
const backgroundTimer = new BackgroundTimer();
