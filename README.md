# ClassMoney

ClassMoney is a web application for managing the finances of school classes. It can be used by a single class or deployed for an entire school, with multiple independent classes managed within the same system.

The application provides a structured way to record class income and expenses, manage financial transactions, track balances, and maintain an auditable history of financial activity. It is designed to support class administrators, parents, teachers, and other authorized users while keeping financial data organized and transparent.

ClassMoney is designed to run as a lightweight web application using Cloudflare Workers and Cloudflare D1. The project is intended to be self-hostable, with each deployment using its own Cloudflare environment and database.

## Requirements

A ClassMoney deployment requires:

- A Cloudflare account
- A Cloudflare D1 database
- A Cloudflare R2 bucket
- A Cloudflare Access application
- Node.js and npm
- Wrangler CLI
- A domain name or Cloudflare-managed hostname for production use

Each deployment requires its own Cloudflare environment and authentication configuration.


## Installation and deployment

The complete installation process is intended to be performed from a clean Cloudflare environment.

The deployment consists of the following major steps:

1. Create or prepare a Cloudflare account
2. Install Node.js and npm
3. Clone the ClassMoney repository
4. Install project dependencies
5. Create the D1 database
6. Create the R2 bucket
7. Initialize the D1 database schema
8. Configure Cloudflare Access
9. Configure the Worker environment variables
10. Configure the Cloudflare Worker
11. Deploy the application
12. Configure the production domain
13. Verify authentication and application access
14. Complete the initial administrator setup

The goal is that a technically competent user can deploy a complete ClassMoney instance from a clean environment by following this documentation without requiring access to the original development environment.

### Cloudflare Access

ClassMoney uses Cloudflare Access for user authentication.

The Worker validates the Cloudflare Access JWT using the `CF-Access-Jwt-Assertion` request header. The JWT signature is verified against the public keys provided by the Cloudflare Access team domain, and the issuer, audience, and token validity are checked before the authenticated email address is accepted by the application.

Each ClassMoney deployment must have its own Cloudflare Access application.

The Access application must protect the ClassMoney Worker and allow the users who should be able to access the application.

### Access environment variables

The following Worker environment variables are required for production authentication:

    TEAM_DOMAIN
    POLICY_AUD

These values are deployment-specific and must not be hardcoded into the source code.

`TEAM_DOMAIN` is the Cloudflare Access Team Domain of the deployment.

Example:

    example.cloudflareaccess.com

`POLICY_AUD` is the Application Audience (AUD) Tag of the Cloudflare Access application protecting ClassMoney.

These values are not passwords or authentication secrets, but they are deployment-specific configuration and therefore should not be committed to the public repository.

Configure them in the Cloudflare Worker dashboard:

    Workers & Pages
        -> classmoney
        -> Settings
        -> Variables and Secrets

Add both variables as text variables.

The actual values will be different for each ClassMoney installation.

Do not put the production values into `wrangler.jsonc` or commit them to Git.

### Cloudflare Access configuration

Create an Access application for the ClassMoney Worker.

The application must protect the ClassMoney Worker URL and define the authentication policy for the users who are allowed to use the application.

After creating the application, obtain its Application Audience (AUD) Tag and use that value as `POLICY_AUD`.

The Access Team Domain is used as `TEAM_DOMAIN`.

The application should be tested after deployment by accessing the ClassMoney application through the protected URL and verifying that `/api/me` returns the authenticated user information.

### Local development

Local development uses Wrangler.

The repository contains separate Wrangler configurations for local development and authentication testing where required.

The development configuration can provide a local Cloudflare Access identity for testing the application without requiring a production Access login.

Start local development with:

    npx wrangler dev --config wrangler.dev.jsonc

Authentication-specific tests can use:

    npx wrangler dev --config wrangler.test.jsonc

The local configurations are environment-specific and must not be published with production credentials or other sensitive information.

### Deployment

The production deployment is performed through Cloudflare Workers Builds.

The repository is connected to the Cloudflare Worker and changes pushed to the configured branch are automatically built and deployed.

A local dry run can be used to verify the Worker configuration without deploying:

    npx wrangler deploy --dry-run

## Features

- Multi-class support
- Class-scoped users and roles
- Income and expense tracking
- Class balance and financial history
- Financial transaction ledger
- Transaction cancellation and reversal handling
- Audit logging
- Notification support
- Role-based access control
- Administrative interface
- Cloudflare Workers and D1 based architecture

## Financial management

ClassMoney maintains the financial state of each class through a combination of financial records, the current class balance, and a transaction ledger.

Financial amounts are stored as integer values in the smallest unit of the configured class currency. The class configuration also defines the currency and the number of currency decimals.

### Charges

Charges represent amounts that are owed to the class by individual children.

A charge has one of the following states:

- `PENDING`
- `PAID`
- `CANCELLED`

The supported lifecycle is:

```text
PENDING -> PAID -> CANCELLED
       \-> CANCELLED
```

A pending charge does not affect the class balance.

When a charge is marked as paid:

- the charge becomes `PAID`
- payment timestamp and user are recorded
- the class balance increases by the charge amount
- a `CHARGE_PAID` financial transaction is created

When a paid charge is cancelled:

- the charge becomes `CANCELLED`
- the original payment information is retained
- cancellation timestamp and user are recorded
- the class balance decreases by the charge amount
- a `CHARGE_CANCELLED` financial transaction is created

Cancelling a pending charge does not affect the class balance.

Payment operations are restricted to users with the `TREASURER` role for the relevant class.

### Expenses

Expenses represent amounts spent from the class balance.

An expense has one of the following states:

- `UNPAID`
- `PAID`
- `CANCELLED`

The supported lifecycle is:

```text
UNPAID -> PAID -> CANCELLED
      \-> CANCELLED
```

An unpaid expense does not affect the class balance.

When an expense is marked as paid:

- the expense becomes `PAID`
- payment timestamp and user are recorded
- the class balance decreases by the expense amount
- an `EXPENSE_PAID` financial transaction is created

When a paid expense is cancelled:

- the expense becomes `CANCELLED`
- the original payment information is retained
- cancellation timestamp and user are recorded
- the class balance increases by the expense amount
- an `EXPENSE_CANCELLED` financial transaction is created

Cancelling an unpaid expense does not affect the class balance.

Expense payment operations are restricted to users with the `TREASURER` role for the relevant class.

### Receipts

Expenses require a receipt reference.

Receipt files are stored in Cloudflare R2. The expense record stores the R2 object key and the receipt MIME type.

The receipt itself is kept outside the D1 database; D1 stores the financial record and its reference to the associated R2 object.

### Financial transaction ledger

Balance-changing financial operations create corresponding records in the financial transaction ledger.

The current transaction types include:

- `INITIAL_BALANCE`
- `CHARGE_PAID`
- `CHARGE_CANCELLED`
- `EXPENSE_PAID`
- `EXPENSE_CANCELLED`
- `FINANCIAL_TRANSACTION_PAID`
- `FINANCIAL_TRANSACTION_CANCELLED`

Ledger entries contain the affected class, amount, transaction type, reference to the originating financial record, description, timestamp, and creating user.

The ledger provides the auditable history of balance-changing operations while the class record stores the current balance.

### Transactional updates

Operations that change financial state update the originating financial record, class balance, and corresponding ledger entry as one database operation.

This ensures that a successful financial state transition keeps the financial record, current balance, and ledger consistent.

## Database

The database schema is maintained as migrations under:

    migrations/

The initial schema contains the core entities required for users, classes, children, roles, charges, expenses, financial transactions, balances, audit logging, and notifications.

Database changes will be introduced through versioned migrations.

## Architecture

The application is designed around the following basic architecture:

    Browser
        |
        v
    Cloudflare Access
        |
        v
    Cloudflare Workers
        |
        +-- Authentication and authorization
        +-- Application API
        +-- Administrative interface
        |
        +------------------+
        |                  |
        v                  v
    Cloudflare D1      Cloudflare R2
    ClassMoney DB      Receipts and files

Cloudflare Access provides the external authentication layer.

The Worker validates the authenticated Access JWT and uses the verified email address to resolve the corresponding ClassMoney user and roles.

Application authorization is enforced by the Worker and remains independent from the Access policy. Cloudflare Access controls who can reach the application, while ClassMoney roles control what an authenticated user can do inside the application.

Additional Cloudflare services may be introduced where they provide a clear benefit to the application.

Detailed architecture documentation will be maintained in the `docs/` directory.


## Administrative module

The administrative module provides the foundation for managing users, classes, and role assignments in a ClassMoney instance. Authentication is handled by Cloudflare Access; ClassMoney does not implement a separate password, session, or login system.

### Authentication

When an authenticated user accesses ClassMoney through Cloudflare Access, the application identifies the user by their email address.

If the user does not yet exist in the ClassMoney database, a user record is created automatically with:

- `active = true`
- no roles
- no child associations

Access authentication therefore establishes the user's identity, while ClassMoney controls what that authenticated user is allowed to do.

### Roles

ClassMoney currently defines three roles:

- `ADMIN` — global administrative role
- `PARENT_REPRESENTATIVE` — class-scoped role
- `TREASURER` — class-scoped role

An `ADMIN` role is global and is not attached to a specific class. Parent Representative and Treasurer roles are always assigned to a specific class.

A user may have multiple class-scoped roles and may have different roles in different classes.

Being an `ADMIN` does not automatically grant financial permissions for every class. An administrator can manage classes and users globally, but must also have an appropriate class-scoped role to operate on a class's finances.

### Class administration

Administrators can:

- view all classes
- create classes
- modify class configuration
- archive classes
- view archived classes

Users with a class-scoped role can access the classes for which they have a relevant role.

Class administration is intentionally separated from class financial operations.

### User administration

Administrators can:

- list users
- view individual users
- activate users
- deactivate users
- assign roles
- remove roles

Deactivating a user also removes their role assignments.

The system protects the integrity of class administration by preventing the deactivation of the last Parent Representative or last Treasurer assigned to a class.

Reactivating a user does not automatically restore previously removed roles. Roles must be assigned again by an administrator.

### Children

Children belong to a specific class and are managed separately from user accounts and roles.

Administrators, Parent Representatives, and Treasurers can manage children within the classes they are authorized to access.

Child records are not physically deleted. Instead, a child can be marked inactive so that historical financial data can remain associated with the child.

The association between a user and their children is maintained separately from role assignments.

### Authorization model

Authorization is enforced at the API level.

The general model is:

| Operation | ADMIN | PARENT_REPRESENTATIVE | TREASURER |
| --- | --- | --- | --- |
| View all classes | Yes | No | No |
| View authorized class | Yes | Yes | Yes |
| Create class | Yes | No | No |
| Modify class | Yes | No | No |
| Archive class | Yes | No | No |
| Manage children | Yes | Yes | Yes |
| Create charge | Only with class-scoped role | Yes | Yes |
| Mark charge as paid | No | No | Yes |
| Cancel charge | Only with class-scoped role | Yes | Yes |
| Create expense | Only with class-scoped role | Yes | Yes |
| Mark expense as paid | No | No | Yes |
| Financial adjustment | No | No | Yes |
| Manage users and roles | Yes | No | No |
| Global audit access | Yes | No | No |
| Class-scoped audit access | Yes | Yes | Yes |

The `ADMIN` column in financial operations therefore does not mean that the global administrator automatically has financial access. For operations marked "Only with class-scoped role", the administrator must also hold the required Parent Representative or Treasurer role for that class.

Payment operations are restricted to Treasurers.

### API surface

The current administrative API includes endpoints for:

- classes
- children
- users
- user role assignments
- health/status checking

The API uses structured JSON responses and application-level HTTP errors for authentication, authorization, validation, not-found, and conflict conditions.

The administrative module is implemented as the backend foundation for the future user interface. The public API surface and endpoint documentation may evolve before the first production release.

## Development status

ClassMoney is currently under active development.

The public repository contains the source code and documentation required to develop and deploy the application. Until a production release is published, interfaces, database structures, configuration requirements, and deployment procedures may change.

## Security

Never commit the following to the repository:

- Passwords
- API keys
- Authentication tokens
- Private keys
- Production database credentials
- Personal data
- Financial data
- Deployment-specific secrets
- Other confidential information

Local secrets and environment-specific configuration should remain outside version control where practical.

Cloudflare Access authentication configuration such as the Team Domain and Application Audience Tag is deployment-specific and must not be hardcoded into the application source code.

The ClassMoney Worker must always validate the Cloudflare Access JWT before using the authenticated identity.


## License

ClassMoney is free to use for personal, educational, school, class, community, and other non-commercial purposes.

Commercial use requires a separate commercial license.

See the `LICENSE` file for the complete terms.

## Support

Information about supporting the continued development of ClassMoney will be added here in the future.

## Commercial licensing

Commercial use requires a separate commercial license.

For commercial licensing inquiries, please contact the copyright holder.

## Release notes

Release notes for published versions will be maintained here.

### Unreleased

Initial development version.
