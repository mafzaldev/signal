---
title: Targeting
description: Contexts, individual targets, rules and the default rule, and the order Signal checks them in.
order: 4
section: Concepts
---

## Contexts

A **context** describes who a flag is evaluated for, usually a user. It has a required `key` and any attributes your rules need:

```ts
{ key: 'user-42', country: 'PK', plan: 'pro', age: 31, groups: ['beta', 'staff'] }
```

- `key` should be stable for that user, account or device. Percentage rollouts depend on it.
- Attribute values can be strings, numbers, booleans, or arrays of those.
- Signal only knows what your app sends. A rule on `plan` never matches a context without a `plan`.

## The order of checks

For a flag that's on, Signal checks in this order and stops at the first answer:

1. **Individual targets:** is this context's key listed?
2. **Rules:** does the context match a rule? Rules are checked top to bottom.
3. **Default rule:** everyone left gets this.

If the flag is off, none of these run and everyone gets the off variation.

## Individual targets

Targets are lists of context keys that always get a chosen variation, such as "`user-1` and `user-2` get `true`". They beat every rule, so they're the way to:

- try a feature on yourself and your team,
- keep one customer on the old version,
- pin a demo account to the new experience.

## Rules

A rule says "if a context matches these conditions, serve this". Each condition compares one attribute with a list of values. A rule matches only when **all** its conditions match; for "A or B", write two rules.

| Comparison                   | Matches when the attribute…     | Example                       |
| ---------------------------- | ------------------------------- | ----------------------------- |
| is one of                    | equals any listed value         | `country` is one of `PK, AE`  |
| contains                     | contains the text               | `email` contains `test`       |
| starts with                  | begins with the text            | `email` starts with `admin`   |
| ends with                    | ends with the text              | `email` ends with `@shop.com` |
| is less than, is at most     | is a number below, or up to, it | `age` is less than `18`       |
| is greater than, is at least | is a number above, or from, it  | `orders` is at least `10`     |

Every comparison has a "not" form, such as "is not one of". A context without the attribute matches neither form.

A rule serves either one variation or a [percentage rollout](/docs/rollouts). Because the first matching rule wins, put specific rules above general ones.

## The default rule

The default rule catches everyone who isn't targeted and matches no rule. It always has a value: one variation, or a percentage rollout. It's where a gradual release to everyone usually lives.

## Testing before you save

The flag page has a **Test a user** panel. Type a context and it shows which step decides and what that user gets, using your unsaved changes. Nothing reaches your apps until you save.
