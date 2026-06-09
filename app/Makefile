.PHONY: install up down clean wait-dynamodb migrate seed reset start dev check test fix

PNPM ?= pnpm

install:
	@$(PNPM) --dir .. --filter system-catalog-app... install --frozen-lockfile

up:
	@docker compose up -d

down:
	@docker compose down

clean:
	@docker compose down --remove-orphans

wait-dynamodb:
	@$(PNPM) wait:dynamodb

migrate:
	@$(PNPM) migrate

seed:
	@$(PNPM) seed

reset:
	@$(PNPM) reset

start:
	@$(PNPM) start

dev:
	@$(PNPM) dev

check:
	@$(PNPM) openapi:check
	@$(PNPM) type-check
	@$(PNPM) lint
	@$(PNPM) format:check

test:
	@status=0; docker compose up -d && $(PNPM) wait:dynamodb && $(PNPM) reset && $(PNPM) test || status=$$?; docker compose down; exit $$status

fix:
	@$(PNPM) format:fix
	@$(PNPM) lint:fix
