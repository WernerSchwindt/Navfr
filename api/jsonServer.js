const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');

const port = 3000;
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
	const fileName = req.query.filename;

	if (fileName) {
		fs.readFile('./data/' + fileName + '.json', 'utf8', (err, data) => {
			if (err) {
				console.error('Error reading file:', err);
				res.status(500).json({ error: 'Error reading ' + fileName + '.' });
				return;
			}

			try {
				res.json(JSON.parse(data));
			}
			catch (parseError) {
				console.error('Error parsing JSON:', parseError);
				res.status(500).json({ error: 'Error parsing ' + fileName + '.' });
			}
		});
	}
	else {
		res.json(fs.readdirSync('./data/flight_plans/', { withFileTypes: true }).filter(item => !item.isDirectory()).map(item => item.name.split('.')[0]));
	}
});

app.post('/', (req, res) => {

	if (!req.query.filename) {
		console.error('No filename specified.');
		return;
	}

	const jsonData = req.body;
	const jsonString = JSON.stringify(jsonData, null, 2); // Pretty print JSON

	fs.writeFile('./data/flight_plans/' + req.query.filename + '.json', jsonString, (err) => {
		if (err) {
			console.error('Error writing to file:', err);
			res.status(500).json({ error: 'Failed to save data.' });
		}
		else {
			res.json({ message: 'Data saved successfully.' });
		}
	});
});

app.listen(port, () => {
	console.log(`Server listening on port ${port}.`);
});