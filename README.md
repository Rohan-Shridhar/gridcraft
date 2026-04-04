# GridCraft 🎨

A React-powered pixel art tool that lets you paint on a 15x15 grid with the full RGB color spectrum.

## Why GridCraft? 🎯

Built with React, GridCraft demonstrates how modern component-based architecture can create interactive, stateful applications without complexity. It's a lightweight, accessible alternative to heavy art software that showcases clean React patterns and efficient state management.

## Features ✨

- **14x14 Drawing Grid** - A perfectly sized canvas for pixel art and simple designs
- **Full RGB Color Support** - Choose any color using an intuitive RGB color picker
- **Export as PNG** - Download your creations to save and share
- **Right-Click to Draw** - Intuitive drawing mechanism using right mouse button
- **Color Selection** - Easily select and switch between different colors
- **Undo/Redo** - Never lose your work with full undo/redo support
- **Erase Mode** - Quickly correct mistakes with the eraser tool
- **Clear Canvas** - Start fresh with a single click
- **Real-time Updates** - See your changes instantly as you draw


## Live Demo 🚀

Experience GridCraft here: **[GridCraft Live](https://rohan-shridhar.github.io/gridcraft/)**

## Getting Started 🚀

**No build tools required!** This project uses CDN-loaded React with Babel Standalone, so you can start coding immediately.


1. **Clone the repository**
    ```bash
    git clone https://github.com/Rohan-Shridhar/gridcraft.git

2. **Navigate to the project folder**

    ```bash
    cd gridcraft

3. **Start local server**
    ```bash
    # Serves on localhost:8000
    python -m http.server

4. **Open localhost:8000 in your browser and start exploring! Edit the .jsx files in the src/ folder and refresh your browser to see changes instantly.**


## Repository Structure 📁
```txt
gridcraft/
├── src/                    # Source files (transpiled in-browser by Babel)
│   ├── App.jsx             # Root component - state management & download logic
│   ├── Footer.jsx          # Footer component with links/info
│   ├── Grid.jsx            # Grid rendering and cell logic
│   ├── Header.jsx          # Header component
│   ├── main.jsx            # Entry point (creates root, renders App)
│   ├── Menu.jsx            # Menu component
│   └── Tools.jsx           # Drawing tools component (pen, eraser, clear)
├── .gitattributes          # Git configuration
├── index.html              # Main HTML - loads React, Babel, html2canvas, components
├── index.css               # Global styles and grid layout
├── LICENSE                 # License file
└── README.md               # Documentation
````
## Technical Implementation 🔧

- **React 18 (CDN)** - Loaded via unpkg, no build step required
- **In-Browser JSX Transpilation** - Babel Standalone converts JSX syntax to JavaScript at runtime
- **Component Architecture** - Modular design with seven specialized components:
  - `App.jsx` - Root component managing core state and download logic
  - `Grid.jsx` - Renders 14x14 grid and handles cell painting
  - `Tools.jsx` - Drawing tools (color picker, eraser, undo/redo, clear)
  - `Menu.jsx` - Download button and high-level controls
  - `Header.jsx` & `Footer.jsx` - Layout components
  - `main.jsx` - React entry point with `createRoot`
- **State Management** - React hooks for grid state, color selection, and undo/redo history
- **PNG Export System** - Multi-step process for high-quality exports:
  1. Temporarily removes grid borders and gaps for clean output
  2. Uses **html2canvas** with `scale: 8` for high-resolution captures
  3. Maintains transparent background with `backgroundColor: null`
  4. Restores original styling after capture
  5. Triggers download via dynamically created anchor tag
- **Undo/Redo System** - History tracking with `past`, `present`, `future` state pattern
- **Event Handling** - Mouse event listeners for right-click drawing
- **Props Communication** - Download function passed from App to Menu (`<Menu downloadImage={downloadImage} />`)

## Built With 🛠️

- **React 18** - UI library (loaded via CDN)
- **Babel Standalone** - In-browser JSX transpilation
- **html2canvas** - DOM-to-image capture library
- **JavaScript (ES6+)** - Core application logic
- **CSS3** - Grid layout, styling, and export-specific classes
- **HTML5** - Structure and download API
- **GitHub Pages** - Hosting and deployment


## How to Contribute 

1. **Fork the repository**
   - Click the "Fork" button at the top right of the repository page

2. **Clone your fork**
   ```bash
   git clone https://github.com/your-username/gridcraft.git
   cd gridcraft
  
3. **Create a feature branch

  ```bash
  git checkout -b feature/YourFeatureName
  ```

4. Make your changes

- Edit files in your code editor
- Test your changes by opening index.html in your browser

5. Commit your changes

  ```bash
  git add .
  git commit -m "Add: brief description of your changes"
  ```

6. Push to your fork

  ```bash
  git push origin feature/YourFeatureName
  ```

7. Open a Pull Request

- Go to your fork on GitHub
- Click "Compare & pull request"
- Provide a clear description of your changes
- Reference any related issues (e.g., "Closes #2")

## Contributors

Thanks to these amazing people who contributed ❤️

<a href="https://github.com/Rohan-Shridhar/gridcraft/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Rohan-Shridhar/gridcraft"/>
</a>


## Guidelines

- Keep pull requests focused on a single feature or fix
- Test your changes locally before submitting
- Update documentation if your changes affect usage
- Be respectful and constructive in discussions
- If adding a new feature, consider adding a brief explanation of why it's useful

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
