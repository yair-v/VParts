const express = require('express');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'src/renderer')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/renderer/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on ' + PORT));