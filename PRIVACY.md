# Privacy Policy

**Last Updated**: February 2025

## Overview

Select & Play ("the Extension") respects and protects your privacy. We do not collect, store, or share any personal data.

## Information We Collect

**We do NOT collect any personal data.**

The Extension only stores the following information locally on your device using Chrome's `storage.sync` API:

- **Azure TTS Configuration** - Your API key and region for Azure Text-to-Speech service
- **Voice Settings** - Your preferred voice and speed settings for Chinese, English, and Japanese
- **UI Mode Preference** - Your selected interaction mode (Mini or Standard)

All data remains on your device and is synced across your Chrome browsers via Google's sync service.

## Information We Share

**We do NOT share any information with third parties**, including:

- No analytics or tracking
- No advertising partners
- No data selling or renting

## Azure TTS Service

When you use the text-to-speech feature:

- Your selected text is sent directly to Microsoft Azure's TTS API to generate audio
- The text is sent only when you explicitly request playback
- Audio is played locally on your device and not stored
- Azure TTS service is governed by [Microsoft's Privacy Policy](https://privacy.microsoft.com/)

## Permissions Explanation

The Extension requests the following permissions:

| Permission | Purpose |
|------------|---------|
| `storage` | Save your Azure configuration and voice settings locally on your device |
| `activeTab` | Display the playback panel and read selected text on the current webpage |

## Data Retention

All data is stored locally on your device. You can delete this data at any time by:

1. Going to Chrome Extensions page (`chrome://extensions/`)
2. Removing the Extension
3. Or clearing extension data in Chrome settings

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be posted in this GitHub repository.

## Contact

If you have questions about this privacy policy, please contact us through:

- GitHub Issues: https://github.com/kelvinzhao/selectandplay/issues
- Email: kelvin.zhao@gmail.com
