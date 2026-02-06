# FWG-OPS Workflow Cheatsheet

## Starting Work (do this FIRST every time you sit down)

1. Open VS Code
2. Open the fwg-ops folder (File > Open Folder > Documents > fwg-ops)
3. Open terminal (Terminal > New Terminal)
4. Run this command to get the latest code:

   git pull

5. Start the development server:

   npm run dev

6. Open browser to http://localhost:3000


## Stopping Work (do this BEFORE closing VS Code)

1. Stop the server by pressing Ctrl + C in the terminal
2. Save your changes to GitHub with these three commands:

   git add .
   git commit -m "brief description of what you changed"
   git push


## Quick Reference

| What you want to do       | Command                                      |
|---------------------------|----------------------------------------------|
| Get latest code           | git pull                                     |
| Start dev server          | npm run dev                                  |
| Stop dev server           | Ctrl + C                                     |
| Save all changes          | git add .                                    |
| Package changes           | git commit -m "description"                  |
| Upload to GitHub          | git push                                     |
| Check status              | git status                                   |


## Troubleshooting

If git pull says "error: Your local changes would be overwritten":
   git stash
   git pull
   git stash pop

If npm run dev fails with missing modules:
   npm install

If you see supabase errors, make sure .env.local file exists.


git pull
Downloads the latest code from GitHub to your computer. Like checking your mailbox for new mail.
git add .
Tells Git "these are the files I want to save." The dot means "all changed files." Like putting papers in an envelope.
git commit -m "message"
Seals the envelope and writes a note on it describing what's inside. The message helps you remember what you changed.
git push
Sends the envelope to GitHub. Now it's in the cloud and available from your other machine.
npm run dev
Starts your website locally so you can view it at localhost:3000.
Ctrl + C
Stops the server.
npm install
Downloads all the helper code your project needs. Only needed when setting up a new machine or if something breaks.


Run these to pull what claude code edits.

git fetch origin
git merge origin/claude/review-legacy-system-0XVMM


check branch command

git branch --show-current


The full workflow:
When you're ready to deploy:

Step 1: Make sure feature branch is pushed

git checkout claude/review-legacy-system-0XVMM
git push -u origin claude/review-legacy-system-0XVMM

Step 2: Switch to main and merge

git checkout main
git pull origin main
git merge claude/review-legacy-system-0XVMM

Step 3: Push main to GitHub (this is probably the command you run)

git push origin main

Step 4: Vercel automatically deploys

Vercel watches your GitHub repository
When it sees main branch updated, it automatically starts deploying
A few seconds later, your production site is live!
So the command you're running in VS Code is probably git push origin main - and that triggers Vercel to deploy automatically.

Summary of the whole process:
Testing phase: You're on claude/review-legacy-system-0XVMM branch

I make edits
You test on localhost:3000
We confirm it works
Moving to main: Run these commands

git checkout main
git pull origin main
git merge claude/review-legacy-system-0XVMM

Deploy: Run this command (the one you usually run)

git push origin main

Vercel does its magic: Automatically deploys in a few seconds