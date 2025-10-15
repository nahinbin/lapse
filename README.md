# Minimal Pomodoro Timer Chrome Extension

A clean and minimal Pomodoro timer Chrome extension with a beautiful gradient design.

## Features

- **25-minute focus sessions** with 5-minute breaks
- **Long break** (15 minutes) after 4 focus sessions
- **Visual progress bar** showing session progress
- **Session counter** tracking your productivity cycles
- **Persistent state** - timer continues even when popup is closed
- **Audio notifications** when sessions complete
- **Minimal, aesthetic design** with smooth animations

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The Pomodoro timer icon should appear in your Chrome toolbar

## Creating Icons

The extension needs icon files in the `icons/` directory:

- `icon16.png` (16x16 pixels)
- `icon32.png` (32x32 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

You can create simple colored square icons or use a tomato emoji (🍅) as the base design. The icons should match the extension's aesthetic with the gradient colors (#667eea to #764ba2).

## Usage

1. Click the extension icon in your Chrome toolbar
2. Click "Start" to begin a 25-minute focus session
3. Take a 5-minute break when the timer completes
4. After 4 focus sessions, enjoy a 15-minute long break
5. The timer automatically cycles through focus and break periods

## Customization

You can modify the timer durations in `script.js`:

- Focus sessions: 25 minutes (default)
- Short breaks: 5 minutes (default)
- Long breaks: 15 minutes (default)

## Files

- `manifest.json` - Chrome extension configuration
- `popup.html` - Extension popup interface
- `styles.css` - Minimal, aesthetic styling
- `script.js` - Timer logic and functionality
- `icons/` - Extension icons (create these)

## Design Philosophy

This extension follows a minimal design philosophy:

- Clean, uncluttered interface
- Beautiful gradient background
- Smooth animations and transitions
- Focus on functionality over features
- Aesthetic typography and spacing
