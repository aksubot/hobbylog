# Hobbylog

A small, static tracker for movement, music practice, business work, and sleep, designed for GitHub Pages. It works without an account and saves data in the current browser. Optionally connect a GitHub Gist to back up and sync your trackers across devices.

The tracker includes a repeating three-week training cycle beginning Monday, November 30, 2026: baseline, push, and deload. Its weekly template has three strength sessions, two short plyometric/agility sessions, one easy run, and a complete rest day. Planned rest days count toward the current streak; missed training days still break it. The plan is a general template; adjust it to your training history and recovery.

Volleyball training can be logged as an optional extra for any date. It is stored alongside that day's workout, so it never replaces or changes the existing training plan.

The **Music** page tracks piano and cello practice separately, including session duration, focus, and optional notes. The **Business** page keeps dated work logs for website making and candle recycling, with optional time spent and notes. The **Sleep** page logs bedtime and wake time, scoring Sunday–Thursday nights by closeness to 21:30 and 07:00. Friday and Saturday nights are flexible and do not count toward the strict score. The **Nutrition** page logs meals and water, and can estimate calories and macros from a small, offline list of common foods using typical servings from USDA FoodData Central SR Legacy. You choose the foods and servings; meal descriptions are not automatically interpreted, and recipes, brands, and actual portions can change the estimates. Weekly food-group variety is a prompt, not a micronutrient or adequacy measure. All trackers use the same local Gist connection; adding a new tracker preserves existing data.

## Publish on GitHub Pages

1. Push these files to a GitHub repository.
2. In the repository, open **Settings → Pages**.
3. Choose **Deploy from a branch**, select the branch and `/ (root)` folder, then save.

## Connect a Gist

1. Create a GitHub personal access token with Gists permission. A classic token needs the `gist` scope; a fine-grained token needs access to Gists.
2. In Hobbylog, choose **Connect a Gist**, paste the token, and select **Connect & sync**.
3. Leave the Gist ID blank to create a new secret (unlisted) Gist, or enter an existing Hobbylog Gist ID to load it.

GitHub secret Gists are unlisted, not private: anyone with the Gist URL can view them. Don't store sensitive information in a Gist. The token is stored in this browser's local storage so the static site can call GitHub's API. It is not included in the published site files. Anyone with access to the same browser profile can use it; disconnect the Gist and revoke the token if that browser is shared or compromised. Workouts are also kept in local storage on the device.
