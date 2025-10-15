# Testing the Lapse Extension

## Quick Test Steps

1. **Load the Extension:**

   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked" and select this folder
   - The extension should appear in your toolbar

2. **Test Basic Functionality:**

   - Click the extension icon to open the popup
   - Click "Start" - timer should begin counting down
   - Click "Pause" - timer should stop
   - Click "Resume" - timer should continue
   - Click "Reset" - timer should reset to 25:00

3. **Test Session Flow:**

   - Complete a focus session (25 minutes)
   - Timer should automatically switch to break mode (5 minutes)
   - Complete 4 focus sessions to trigger long break (15 minutes)

4. **Test Persistence:**
   - Start a timer
   - Close the popup
   - Reopen the popup - timer should still be running

## Expected Behavior

- **Focus Mode:** 25 minutes, red accent color
- **Break Mode:** 5 minutes, teal accent color
- **Long Break:** 15 minutes, blue accent color
- **Progress Bar:** Fills as time progresses
- **Session Counter:** Shows current session (1-4)
- **Audio Notification:** Plays sound when session completes

## Troubleshooting

- If icons don't appear, create them using `create-icons.html`
- If timer doesn't persist, check Chrome storage permissions
- If audio doesn't work, check browser audio permissions
