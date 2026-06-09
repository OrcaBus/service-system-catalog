PNPM ?= pnpm

.PHONY: check check-all fix fix-all install test

check:
	@$(PNPM) audit
	@$(PNPM) prettier
	@$(PNPM) lint
	@if command -v pre-commit >/dev/null 2>&1; then pre-commit run --all-files; else echo "pre-commit not installed; skipping pre-commit hooks"; fi

check-all: check
	@(cd app && $(MAKE) check PNPM="$(PNPM)")

fix:
	@$(PNPM) prettier-fix
	@$(PNPM) lint-fix

fix-all: fix
	@(cd app && $(MAKE) fix PNPM="$(PNPM)")

install:
	@$(PNPM) install --frozen-lockfile
	@if command -v pre-commit >/dev/null 2>&1; then pre-commit install; else echo "pre-commit not installed; skipping hook install"; fi

test:
	@$(PNPM) test
