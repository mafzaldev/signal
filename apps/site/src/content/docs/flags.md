---
title: Flags and environments
description: Flags, their kinds and variations, projects and environments, and the on/off switch.
order: 3
section: Concepts
---

## Projects and environments

A **project** groups the flags for one product or app, such as `web` or `mobile`. Each project has **environments**, `Development`, `Staging` and `Production` by default, and you can add your own.

Every flag exists in every environment of its project, but its settings are separate in each. A flag can be fully on in Staging while it's at 5% in Production.

## Flags

A flag has:

- a **key**, the name your code uses, such as `new-checkout`. Lowercase letters, numbers, `.`, `_` and `-`. It can't change after the flag is created, because your code refers to it.
- a **name** and **description** for people reading the dashboard.
- a **kind**: `boolean`, `string`, `number` or `json`.
- two or more **variations**, the values it can serve.

| Kind      | Example variations                          |
| --------- | ------------------------------------------- |
| `boolean` | `true`, `false` (always these two)          |
| `string`  | `"blue"`, `"green"`, `"orange"`             |
| `number`  | `6`, `12`, `24`                             |
| `json`    | `null`, `{ "text": "Free shipping today" }` |

## On and off

Each flag has a switch per environment.

- **Off:** everyone gets the **off variation**, usually `false`, and nothing else is checked. This is your kill switch when a feature misbehaves.
- **On:** Signal works through [targeting](/docs/targeting) to decide each user's value.

Turning a flag off keeps its targets, rules and rollout. Turn it back on and it picks up exactly where it was.

A new flag starts off in every environment.

## Client-side access

Each flag has a **Client-side access** setting, off by default. Only flags with it on can be read by the [Browser SDK](/docs/browser-sdk). Leave it off for flags only your servers use, and they never reach a web page.

## Removing a flag

Once a flag has served the same value to everyone for a while, delete the check from your code first, then delete the flag. Apps that still check a deleted flag get the default value they pass.
