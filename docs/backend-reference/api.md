# Venduzily — API

## Base URL

The API base URL depends on the deployment environment.

Development:

`http://localhost:<port>`

---

# Authentication

Protected endpoints require authentication.

Authentication mechanism:

TODO: Document authentication mechanism.

The authenticated user must be available to the application authorization layer.

---

# Users

## Create User

`POST /users`

Creates a new user.

### Request

```json
{
  "name": "John Doe",
  "email": "john@example.com"
}