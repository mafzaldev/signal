---
title: Percentage rollouts
description: How Signal splits users by percentage, why each user's answer is stable, and how to release gradually.
order: 5
section: Concepts
---

A percentage rollout splits contexts between variations, such as 20% `true` and 80% `false`. Any rule, and the default rule, can serve one.

## How users are split

Each context lands on a **bucket**, a number from 0 to 99,999, computed by hashing the flag and the context's key. A 20% rollout serves the first variation to buckets 0 to 19,999 and the second to the rest.

```
20%:  true = 0 ──── 19,999 │ false = 20,000 ──────────── 99,999
30%:  true = 0 ──────────── 29,999 │ false = 30,000 ──── 99,999
```

Buckets give rollouts three useful properties:

- **Stable:** the same context always gets the same bucket, so a user's answer doesn't flip between page loads, servers or apps.
- **Sticky:** raising 20% to 30% only adds users. Everyone who had the feature keeps it.
- **Independent:** each flag hashes differently, so being in one flag's first 20% says nothing about any other flag.

The 0 to 99,999 range means you can release in steps as small as 0.001%, for example 0.1% of a very large user base.

## Releasing gradually

1. Set the default rule to a small percentage, such as 5%, and save.
2. Watch your errors and metrics.
3. Raise it to 25%, 50% and 100% as you gain confidence.
4. If something goes wrong, turn the flag off. Everyone gets the off variation at once, and your rollout is kept for when you turn it back on.

Every change is in the audit log, with who made it and when.

## Things that reshuffle users

- **A changing key.** If your app sends a new random key on every visit, that visitor can land in a different bucket each time. Use a stable ID.
- **Three or more variations.** With A, B and C at 33% each, growing B moves where C starts, so some users switch from C to B. Two-variation rollouts are always sticky.
