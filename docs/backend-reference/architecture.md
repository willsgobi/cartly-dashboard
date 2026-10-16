# Cartly — Architecture

## Technology Stack

- NestJS
- TypeScript
- Prisma
- PostgreSQL

## General Principles

The project follows:

- Clean Architecture
- SOLID
- Separation of Concerns
- Dependency Injection
- Repository Pattern

The existing project structure and conventions must be preferred over introducing new patterns.

---

## Controllers

Controllers are responsible for HTTP concerns.

Controllers should:

- Receive requests
- Receive and validate DTOs
- Call application/services/use cases
- Return responses

Controllers must not contain business rules.

Avoid database access directly from controllers.

---

## Services / Use Cases

Services or Use Cases contain application and business logic.

They are responsible for:

- Executing business rules
- Coordinating repositories
- Validating business conditions
- Calling external services when necessary

Business rules must not be duplicated across controllers.

---

## Repositories

Repositories are responsible for persistence.

Repositories should:

- Encapsulate database access
- Use Prisma when appropriate
- Provide data required by the application layer

Business rules should not be implemented inside repositories.

---

## DTOs

DTOs define API input contracts.

DTOs should be used for:

- Request bodies
- Query parameters
- Route parameters when appropriate

DTO validation must happen before business logic is executed.

---

## Product Architecture

Product business rules must be enforced in the domain/application layers.

The ProductType enum defines the product pricing strategy:

- NORMAL
- VARIANT
- VARIANT_WITH_PRICE

The application layer must validate the consistency between:

- ProductType
- Product.price
- ProductVariant.price
- Product variants

The infrastructure layer is responsible only for persistence and must not contain business decisions.

Product creation and update operations must use the appropriate use cases and repository abstractions.

The Product repository must ensure company-scoped data access and prevent cross-company relationships.

---

## Prisma

`prisma/schema.prisma` is the source of truth for the database model.

Before implementing database functionality:

1. Inspect the existing schema.
2. Understand existing relationships.
3. Reuse existing models.
4. Avoid unnecessary schema changes.

Do not modify the Prisma schema unless explicitly required by the feature.

---

## Dependency Injection

Dependencies should be injected rather than instantiated manually.

Prefer NestJS dependency injection.

---

## Error Handling

Use appropriate NestJS exceptions.

Do not expose:

- Stack traces
- Database errors
- Internal implementation details
- Sensitive information

---

## Testing

Business logic should have unit tests.

Important business invariants must be covered by tests.

Examples:

- A company cannot exist without a user.
- A category cannot exist without a company.
- A product cannot exist without a category.
- A product cannot reference a category from another company.
- A user cannot access another company's resources.