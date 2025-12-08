# Frontend Authentication Microservice

A self-contained frontend microservice for Authentication (Login, Signup, Forgot Password) built with React, TypeScript, and Vite.

## Features

- **Mock Mode**: Runs entirely without a backend using an internal mock service.
- **Authentication Flows**:
  - Login
  - Signup with OTP verification
  - Forgot Password
- **UI/UX**:
  - Responsive design (Desktop/Tablet/Mobile)
  - Accessible components
  - Toast notifications
  - Form validation

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. Clone the repository or navigate to the project directory:
   ```bash
   cd c:\New-SFCS
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application

Start the development server:

```bash
npm run dev
```

Open your browser and navigate to `http://localhost:5173`.

## Configuration

The application uses an environment variable to determine whether to use the real API or the mock service.

- Create a `.env` file in the root directory (if it doesn't exist).
- To use **Mock Mode**, leave `VITE_API_BASE_URL` empty:

  ```env
  VITE_API_BASE_URL=
  ```

- To use a **Real Backend**, set the URL:

  ```env
  VITE_API_BASE_URL=https://api.example.com
  ```

## Project Structure

- `src/components`: Reusable UI components (Button, FormField, OtpInput, Toast).
- `src/pages`: Page components (Login, Signup, Forgot).
- `src/hooks`: Custom hooks, including `useMockAuth` for the mock service.
- `src/styles`: Global styles and CSS variables.
- `src/routes.tsx`: Routing configuration.

## Technologies

- React 18+
- TypeScript
- Vite
- CSS Modules
- React Router DOM
