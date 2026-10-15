# Review of the GPT build (me_GPT/site), 15 Oct 2026

Checked by Claude, read only. Nothing changed in `site/`.

## What is good, keep it

- The structure: home, a Work page with filters, an About page, one case-study page per project, a 404 page. Much easier to read than the single long page that is live now.
- The copy is plain and in first person. Zero long dashes on all 12 pages. Every case study says what I did and where AI helped, and says plainly what is a demo, a concept or unfinished.
- The hero: name, "Twelve years in vehicle finance. Now building toward product management.", and the town-by-town timeline on the right. The empty-space problem in the hero is gone.
- The career section matches the resume (four roles, correct dates).
- All 15 outside links work (checked: CERCIT demo, UPI app, HireMate demo and launch PDF, all repos).
- Resume PDF is the same file as the live one.
- Fonts and images are local, so nothing loads from outside.

## What is not OK

1. **DealerFinance / FinStack page.** You said FinStack is not needed. The page also names Aditya Sharan and says most of the build isn't done. Remove it.
2. **SamsMind page.** The repo is private and nothing is published. There's nothing a visitor can open. Remove it for now and add it back when the public demo exists.
3. **WPL page is wrong.** It says "my dataset and analysis are currently local". They aren't: the dataset and notebook have been public on Kaggle since 27 Sep. Keep the page, link the Kaggle dataset and notebook, and fix that line.
4. **PM Portfolio is missing.** It's on the live site now, and the repo has 5 sessions. Add it back as a project.
5. **No Kaggle link** in the footer or contact area. Add it if WPL stays.
6. **Every case study uses the same 4-part numbered template** ("Inside the project 01–04"). Fine for a portfolio, but it reads as machine-made after the third page. Small fix: vary the section titles so they don't all follow the same pattern. Don't change the layout.
7. **Hobbies line on About** ("Photography, gaming, fountain pens, audio gear and filter coffee"). GPT wrote it. Check that it's true before it goes live.

## Never goes to GitHub

The rest of `me_GPT` must never be pushed. That includes `repository-inventory/`, the audit files, `github-*.json`, `local-*.json/csv`, `server.*` and the screenshots. Only `site/` plus the three build files (`build-site.py`, `project-content.json`, `validate-site.py`) go up.

## Decisions (my defaults; change any line before starting the cloud session)

| # | Question | Default |
|---|---|---|
| 1 | DealerFinance page | Remove |
| 2 | SamsMind page | Remove |
| 3 | WPL page | Keep, link Kaggle |
| 4 | PM Portfolio | Add back (5 sessions) |
| 5 | Tagline | Keep GPT's ("Twelve years in vehicle finance…"), drop "Built in the field." |
| 6 | "Claude wrote most of the code" on CERCIT | Keep, it's honest |
| 7 | Hobbies line | Keep only if Sameer confirms it's true |

Result: 7 projects. CERCIT, UPI recovery, HireMate, pagefit, World of Coins, WPL, PM Portfolio.
