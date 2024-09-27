# Desk Dazzle - All-in-One Tool App

### Version: 0.1.0

#### Author: Jayash Bhandary

---

## Description

**Desk Dazzle** is a comprehensive, all-in-one web application designed to enhance productivity by combining various essential tools. Built using the latest web technologies, Desk Dazzle offers a seamless user experience with a clean interface, offline support, and real-time functionality. From QR code generation and image resizing to text editing and cloud integration, Desk Dazzle simplifies your workflow in one place.

---

## Features

- **Progressive Web App (PWA)**: Install Desk Dazzle on your desktop or mobile device and use it as a standalone app, thanks to PWA support.
- **GraphQL API Integration** with `@apollo/client` and `graphql` for real-time data fetching.
- **Firebase Integration** for secure cloud storage and hosting.
- **QR Code Generation** via `qrcode.react`.
- **Image Resizing** with `react-image-file-resizer`.
- **Rich Text Editing** using `react-quill`.
- **Real-time Updates** with `subscriptions-transport-ws`.
- **Animation Support** powered by `GSAP` and `@gsap/react`.
- **Offline Mode** and caching strategies using `Workbox`.
- **Clock Widget** via `react-clock`.
- **Color Palette Picker** integrated through `react-color-palette`.
- **REST API Support** using `axios` for external service interaction.

---

## Web Manifest

Desk Dazzle supports Progressive Web App (PWA) features:

- **App Name**: Desk Dazzle
- **Short Name**: Desk Dazzle
- **Start URL**: `/apps`
- **Display Mode**: Standalone (desktop and mobile app-like experience)
- **Theme Color**: Black (`#000000`)
- **Background Color**: White (`#ffffff`)
- **App Icons**: 
  - `favicon.ico` (multiple sizes: 16x16, 24x24, 32x32, 64x64)
  - `logo192.png` (192x192 for larger displays)

Additionally, Desk Dazzle provides quick access to documentation through app shortcuts:
- **Documentation Shortcut**: `/docs`

---

## Getting Started

### Prerequisites

Ensure you have the following installed:

- **Node.js** (v14 or later)
- **npm** (v6 or later)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/JayashBhandary/deskdazzle.git
Navigate to the project directory:

bash
Copy code
cd deskdazzle
Install the dependencies:

bash
Copy code
npm install
Running the App
To start the app in development mode:

bash
Copy code
npm start
This will run the app locally at http://localhost:3000.

Building for Production
To create a production build:

bash
Copy code
npm run build
The build will be placed in the build/ folder.

Deploying
Desk Dazzle can be deployed using Firebase:

bash
Copy code
npm run deploy
Ensure that Firebase CLI is installed and configured.

Available Scripts
In the project directory, you can run the following:

npm start: Starts the development server.
npm run build: Bundles the app for production.
npm run test: Runs the test suite.
npm run eject: Ejects the app from Create React App configurations.
Technologies Used
React.js: Frontend library for building responsive user interfaces.
GraphQL: Data query language and runtime for fetching data efficiently.
Firebase: Backend-as-a-Service for secure storage and hosting.
GSAP: Animation library for highly performant web animations.
Workbox: Tools for enabling offline caching and service workers.
PWA Support: Progressive Web App features for installation on devices.
Contributing
Contributions are welcome! If you'd like to suggest improvements or report issues, please open an issue or submit a pull request.

License
This project is licensed under the MIT License. See the LICENSE file for more details.

Repository
Desk Dazzle GitHub Repository
