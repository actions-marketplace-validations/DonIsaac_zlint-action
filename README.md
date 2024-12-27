# zlint-action

Github Actions task for [ZLint](https://github.com/DonIsaac/zlint).

## Example

```yaml
# .github/workflows/zlint.yml
name: ZLint

on: [push, pull_request]

jobs:
  zlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: ZLint
        uses: DonIsaac/zlint-action@v1
        with:
          # When true (the default value), only files changed in a PR get
          # linted. Has no effect on pushes.
          # Non-zig files are ignored regardless of this setting.
          diff-only: true
```
