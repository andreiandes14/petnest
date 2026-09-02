---
name: Zod codegen compatibility
description: The workspace uses Zod 3 while current Orval can emit Zod 4-only integer helpers.
---

When extending the OpenAPI contract, avoid integer schemas unless the workspace Zod version and generator output are intentionally upgraded together; numeric identifiers can use number schemas at the contract boundary and still be validated/coerced in route code.

**Why:** Codegen initially emitted `zod.int()`, which the installed Zod 3 package does not expose and caused the shared typecheck to fail.

**How to apply:** Check the generated Zod output immediately after contract changes and keep dependency upgrades explicit rather than editing generated files.