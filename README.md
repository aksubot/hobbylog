# Hobbylog

A small, static tracker for movement, music practice, and business work, designed for GitHub Pages. It works without an account and saves data in the current browser. Optionally connect a GitHub Gist to back up and sync your trackers across devices.

The tracker includes a repeating three-week training cycle beginning Monday, November 30, 2026: baseline, push, and deload. Its weekly template has three strength sessions, two short plyometric/agility sessions, one easy run, and a complete rest day. Planned rest days count toward the current streak; missed training days still break it. The plan is a general template; adjust it to your training history and recovery.

The **Music** page tracks piano and cello practice separately, including session duration, focus, and optional notes. The **Business** page keeps dated work logs for website making and candle recycling, with optional time spent and notes. All three trackers use the same local Gist connection; adding a new tracker preserves existing data.

## Publish on GitHub Pages

1. Push these files to a GitHub repository.
2. In the repository, open **Settings → Pages**.
3. Choose **Deploy from a branch**, select the branch and `/ (root)` folder, then save.

## Connect a Gist

1. Create a GitHub personal access token with Gists permission. A classic token needs the `gist` scope; a fine-grained token needs access to Gists.
2. In Hobbylog, choose **Connect a Gist**, paste the token, and select **Connect & sync**.
3. Leave the Gist ID blank to create a new secret (unlisted) Gist, or enter an existing Hobbylog Gist ID to load it.

GitHub secret Gists are unlisted, not private: anyone with the Gist URL can view them. Don't store sensitive information in a Gist. The token is stored in this browser's local storage so the static site can call GitHub's API. It is not included in the published site files. Anyone with access to the same browser profile can use it; disconnect the Gist and revoke the token if that browser is shared or compromised. Workouts are also kept in local storage on the device.
