# Using Slate: a beginner's guide

## Two links, two purposes

- **Use the whiteboard:** https://vmirkvss.github.io/slate-whiteboard/
- **View the project code:** https://github.com/vmirkvss/slate-whiteboard

The repository is an online folder with your source code and change history. GitHub Pages turns that code into a website you can open in your browser. You do not need to open the repository or start Terminal for daily lessons.

## Every day

1. Open the whiteboard link above in your usual browser and bookmark it.
2. Click the title to name your lesson. Pick the pen and start writing.
3. Use **New page** for the next part of the lesson.
4. Wait for **Saved locally** before closing the tab.
5. After a lesson, click **Export → Slate file** to keep an editable backup. Use **PDF** to send notes to a student.
6. Next time, open the same website in the same browser profile. Your latest lesson returns. The dropdown beside the title opens your other whiteboards.

Your Mac does not need to keep a development server running. GitHub serves the site. The app is public, but your lessons are stored locally in your browser—not in the public code repository.

**Saving is not cloud sync.** A different browser, device, private window, or website address has separate storage. Clearing browser data can delete lessons. For another computer, export a Slate file, transfer it, then use the title dropdown → **Import lesson** on that computer.

If you wrote notes in the earlier local preview, export them there and import them on the hosted site. Local preview storage does not automatically move to the website.

## Run or change it on your Mac (optional)

Only do this when developing the app or testing changes. Daily use needs only the website link.

Install Node.js 22 LTS or newer from https://nodejs.org/ if `node --version` does not work in Terminal. Then install the project's package manager once:

```sh
npm install --global pnpm@10.11.0
```

For the copy already on this Mac, open Terminal and run these lines one at a time:

```sh
cd ~/Documents/ChatGPT/Whiteboard
pnpm install
pnpm dev
```

Keep Terminal open. Open the Local URL printed there (normally http://localhost:5173). Press **Control+C** in that Terminal when finished. Do not double-click `index.html`: this app needs the development server or a built website.

On a different computer, obtain a copy first:

```sh
git clone https://github.com/vmirkvss/slate-whiteboard.git
cd slate-whiteboard
pnpm install
pnpm dev
```

`pnpm install` downloads libraries; `pnpm dev` starts the local app. `pnpm build` generates the production website in `dist/`; `pnpm preview` lets you test that build locally.

## Publish an update

After editing and testing the project:

```sh
pnpm test
pnpm build
git add .
git commit -m "Describe what you changed"
git push
```

`git add` selects files, `git commit` records a version, and `git push` uploads it. The GitHub **Actions** tab shows the **Publish Slate** workflow. Once it is green, refresh your bookmarked website. You do not manually upload `node_modules` or `dist`.

The workflow installs dependencies, runs unit tests, builds Slate, and publishes the result. If it turns red, open that run and inspect the failed step; the previous successful website normally remains available.

## Hosting settings

In the repository, open **Settings → Pages**. The publishing source should be **GitHub Actions**. The website link appears on this page once deployment finishes. To publish again without editing files, go to **Actions → Publish Slate → Run workflow**.

Public repositories support free GitHub Pages hosting. This setup does not use a paid server or a custom domain. Keep the repository name and website URL stable so existing bookmarks and your storage location remain consistent.

Official references: [GitHub Pages publishing](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [Vite deployment](https://vite.dev/guide/static-deploy.html).
