# AI Link Safety Inspector Chrome Extension

A Chrome extension that uses AI to analyze links for safety. This extension can inspect either all links on a page or a specific selected link.

## Features

- Inspect all links on the current page
- Inspect a specific selected link
- Real-time safety analysis
- Clean and intuitive user interface

## Installation

1. First, create the required icons:
   - Create an `icons` folder if it doesn't exist
   - Create three icon files in the `icons` folder:
     - `icon16.png` (16x16 pixels)
     - `icon48.png` (48x48 pixels)
     - `icon128.png` (128x128 pixels)
   - You can create these icons using any image editor, or download placeholder icons

2. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right corner
   - Click "Load unpacked" and select the directory containing these files

## Usage

1. Click the extension icon in your Chrome toolbar
2. Choose between two options:
   - "Inspect All Links": Analyzes all links on the current page
   - "Inspect Selected Link": Select a specific link on the page and click this button to analyze it

## Note

This is a demonstration version that uses basic heuristics for link analysis. For a production version, you would want to integrate with a proper AI service for more accurate results.

## Development

The extension is built using:
- HTML/CSS for the popup interface
- JavaScript for the extension logic
- Chrome Extension Manifest V3

## Files

- `manifest.json`: Extension configuration
- `popup.html`: Extension popup interface
- `popup.js`: Popup logic
- `content.js`: Link analysis logic
- `icons/`: Directory containing extension icons 