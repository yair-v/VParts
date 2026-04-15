const express = require('express');
const path = require('path');

const app = express();

// נתיב לתיקיית ה-UI
const rendererPath = path.join(__dirname, 'src', 'renderer');

// מגיש קבצים סטטיים
app.use(express.static(rendererPath));

// חשוב! fallback לכל הנתיבים
app.get('*', (req, res) => {
  res.sendFile(path.join(rendererPath, 'index.html'));
});

// פורט של Render
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});