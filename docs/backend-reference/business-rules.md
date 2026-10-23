# Venduzily — Business Rules

## Users

- A user can have one or more companies.
- A company must always belong to a user.
- A company cannot exist without an associated user.

## Companies

- A company belongs to exactly one user.
- A user may own multiple companies.
- Company-owned resources must remain isolated from other companies.

## Categories

- A category must belong to a company.
- A category cannot exist without a company.
- Categories must not be shared between companies.

## Products

- Every product must belong to a company.
- Every product must belong to a category.
- The category must belong to the same company as the product.
- Cross-company product/category relationships are forbidden.


## Product Types

A product can have one of three types:

### NORMAL

A normal product has no variants and has its own price.

Rules:
- `Product.price` is required.
- The product cannot have variants.

### VARIANT

A variant-based product has multiple variants, but all variants share the same product price.

Rules:
- `Product.price` is required.
- The product must have at least one variant.
- `ProductVariant.price` must be null.
- All variants use the product price.

### VARIANT_WITH_PRICE

A variant-based product where each variant has its own price.

Rules:
- `Product.price` must be null.
- The product must have at least one variant.
- Every variant must have its own price.
- Variant prices may be different.

### Invalid States

The following states are not allowed:

- NORMAL product with variants.
- NORMAL product without a price.
- VARIANT product without a price.
- VARIANT product with variant prices.
- VARIANT_WITH_PRICE product without variants.
- VARIANT_WITH_PRICE product with a variant without a price.

## Data Isolation

- Resources belonging to one company must never be accessible through another company.
- A valid resource ID does not imply that the current user is authorized to access the resource.
- Company ownership/access must always be validated.

## Future Business Rules

New business rules must be documented here before or alongside their implementation.

The application must not invent business rules that are not documented.