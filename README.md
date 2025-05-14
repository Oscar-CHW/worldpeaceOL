# 天下太平 (Tianxia Taiping) Online

A web application that displays the title "天下太平" (Peace Under Heaven) with a user account system.

## Features

- Clean, minimalist design with a gradient background
- Responsive layout (works on mobile devices)
- Interactive animation effects
- Complete user account system with login/signup functionality
- User rank tracking system

## Technologies Used

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js with Express
- **Database**: SQLite with Prisma ORM
- **Authentication**: Express-session, bcrypt

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/IllegalTempo/TinHaTaiPing.git
   cd TinHaTaiPing
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Initialize the database:
   ```
   npx prisma migrate dev --name init
   ```

4. Start the server:
   ```
   npm start
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Usage

1. Visit the home page to see the "天下太平" title with animations
2. Register for an account using the signup page
3. Log in with your credentials
4. View your profile and rank in the dashboard
5. Click on the title for interactive effects

## File Structure

- `index.html` - The main page with the title
- `login.html` - User login page
- `signup.html` - New user registration page
- `dashboard.html` - User profile and information page
- `styles.css` - Main styling for the website
- `script.js` - Frontend JavaScript for animations
- `server.js` - Node.js/Express backend server
- `prisma/schema.prisma` - Database schema definition

## License

This project is open source and available under the MIT License. 