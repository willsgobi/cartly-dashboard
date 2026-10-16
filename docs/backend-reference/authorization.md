# Cartly — Authorization

## Authentication

Every protected operation requires an authenticated user.

Authentication identifies the user.

Authorization determines what the user is allowed to do.

Authentication alone does not grant access to resources.

---

## Administrator

The administrator has full management permissions.

The administrator can:

- Create users
- Update users
- Remove users
- Manage user permissions
- Create companies
- Update companies
- Remove companies
- Create categories
- Update categories
- Remove categories
- Create products
- Update products
- Remove products
- View management reports
- Access administrative functionality

---

## Regular Users

Regular users must only be able to perform operations allowed by their assigned permissions.

Permissions must be explicitly defined.

Never assume that an authenticated user has administrative privileges.

---

## Company Access

Users may have access to one or more companies.

Before accessing a company-owned resource:

1. Identify the authenticated user.
2. Identify the company associated with the operation.
3. Verify that the user has access to that company.
4. Verify the required permission.
5. Execute the operation only after authorization succeeds.

---

## Resource Ownership

For resources such as:

- Categories
- Products
- Other company-owned entities

the application must verify company ownership/access.

Never authorize access based only on the resource ID.

Example:

A user must not be able to access:

`GET /products/:id`

only because the product ID exists.

The system must also verify that the product belongs to a company the authenticated user can access.

---

## Administrative Operations

Administrative operations must require the appropriate administrative permission.

Never bypass authorization because the endpoint is internal or because the request comes from an authenticated user.