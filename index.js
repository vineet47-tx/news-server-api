//File path: /index.js (root)
// Import required modules
const express = require('express');
const path = require('path');

// Create an Express application
const app = express();

// Define the port for the server to listen on
const port = 3000;

// Set EJS as the view engine
app.set('view engine', 'ejs');

/* 
Set the views directory to 'views'
 in the current directory
 */
app.set('views', path.join(__dirname, 'views'));

/* 
 Define a route to render the Pug
 template when the root path is accessed
 */
app.get('/', (req, res) => {
    //Sending this data from Server
    const data = {
        name: 'ABC News',
        items: ['How are India-Taliban relations changing? | Explained', 
            'What are the new PF withdrawal guidelines? | Explained', 
            'What is the latest offering by OpenAI which has caused much outrage? | Explained',
            'How are India-Taliban relations changing? | Explained']
    };
    // Render the EJS template named 'index' and pass the data
    res.render('index', data);
});

// Start the server and listen on the specified port
app.listen(port, () => {
    // Display a message when the server starts successfully
    console.log(`Server is running at http://localhost:${port}`);
});