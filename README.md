# MockVerse Backend

This is a Node.js project.

## Installation

### Prerequisites

1. Ensure you have **Node.js** (v16+) and **npm** or **yarn** installed.
2. Clone the repository:
   ```bash
   git clone https://github.com/MockVerseAI/mockverse-backend.git
   ```
3. Create a `.env` file in the root directory. Use the `.env.example` file as a template.

### Install Dependencies

Run the following command to install all required dependencies:

```bash
npm install
```

## Configuration

1. Copy the `.env.example` file and create a `.env` file:
   ```bash
   cp .env.example .env
   ```

2. Replace the placeholder values in `.env` with your actual credentials.

3. Ensure OAuth redirect URLs are correctly set up in the Google Cloud Console and GitHub OAuth App.

## Running the Project

### Development

To start the development server, run:

```bash
npm run dev
```

The server will run at `http://localhost:8080` by default.

### Production

Build and run the project in production mode:

```bash
npm start
```

## Tech Stack

- **Node.js**: Backend runtime.
- **Express.js**: Server framework.
- **MongoDB**: Database.
- **JWT**: Token-based authentication.
- **OAuth**: Third-party SSO using Google and GitHub.
- **Nodemailer**: Email integration.


## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch (`feature/your-feature-name`).
3. Commit your changes and push to your forked repository.
4. Submit a Pull Request.


## License

This project is licensed under the [MIT License](LICENSE).


## Acknowledgements

- **Google Cloud Console**: For OAuth 2.0 authentication.
- **GitHub OAuth**: For GitHub SSO.
