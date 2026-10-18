---
title: Introduction
description: What Signal is, the pieces it's made of, and how a release flows through them.
order: 1
section: Start here
---

Signal is release control for your team. You put new code behind a **flag**, decide who sees it, roll it out gradually, and switch it off in under a second if something goes wrong, all without deploying.

## The pieces

| Piece           | What it does                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| **Dashboard**   | Where your team creates flags, sets targeting per environment, manages keys and members, and reads history |
| **API**         | Stores flags and pushes every change to connected apps as it happens                                       |
| **Server SDK**  | Runs in your backend. Downloads the rules once and evaluates flags in memory                               |
| **Browser SDK** | Runs in web pages. Gets one user's values from the API, never the rules                                    |
| **Postgres**    | Stores flags, members and the history of every change                                                      |
| **Redis**       | Carries live updates between API instances                                                                 |

Signal is self-hosted: you run the API, the dashboard, Postgres and Redis on your own infrastructure, so your flags and your users' attributes stay in your network.

## How a release flows

1. Someone on your team creates a flag in the dashboard. It starts **off** in every environment.
2. Your code checks the flag through an SDK and passes a default value, so the check is safe even before Signal answers.
3. You turn the flag on for yourself, then for a group, then for a percentage of everyone.
4. Each change is saved with an entry in the audit log and reaches every connected app within a second.
5. When the feature is fully out, you remove the check from your code and delete the flag.

## Where to go next

- [Self-hosting](/docs/self-hosting) to run Signal yourself.
- [Flags and environments](/docs/flags) for the core ideas.
- [Server SDK](/docs/server-sdk) or [Browser SDK](/docs/browser-sdk) to read flags in your app.
