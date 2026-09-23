# ClassMoney

ClassMoney is a web application for managing the finances of school classes. It can be used by a single class or deployed for an entire school, with multiple independent classes managed within the same system.

The application provides a structured way to record class income and expenses, manage financial transactions, track balances, and maintain an auditable history of financial activity. It is designed to support class administrators, parents, teachers, and other authorized users while keeping financial data organized and transparent.

ClassMoney is designed to run as a lightweight web application using Cloudflare Workers and Cloudflare D1. The project is intended to be self-hostable, with each deployment using its own Cloudflare environment and database.

## Requirements

> This section is currently a placeholder and will contain the complete installation and deployment requirements before the first production release.

The planned deployment environment requires:

- A Cloudflare account
- A Cloudflare D1 database
- Node.js and npm
- Wrangler CLI
- A domain name or Cloudflare-managed hostname for production use

The exact required versions, Cloudflare configuration, database initialization procedure, environment variables, authentication configuration, and deployment steps will be documented here.

## Installation and deployment

> This section is currently a placeholder.

The final documentation will provide a complete step-by-step installation and deployment guide, including:

1. Required accounts and services
2. Local development environment setup
3. Cloudflare configuration
4. D1 database creation
5. Database schema initialization
6. Environment and secret configuration
7. Local development
8. Production deployment
9. Domain and DNS configuration
10. Initial administrator setup

The goal is that a technically competent user can deploy a complete ClassMoney instance from a clean environment by following this documentation without requiring access to the original development environment.

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
    Cloudflare Workers
        |
        +-- Authentication and authorization
        +-- Application API
        +-- Administrative interface
        |
        v
    Cloudflare D1
        |
        +-- ClassMoney database

Additional Cloudflare services may be introduced where they provide a clear benefit to the application.

Detailed architecture documentation will be maintained in the `docs/` directory.

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
- Other confidential information

Local secrets and environment-specific configuration must remain outside version control.

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
