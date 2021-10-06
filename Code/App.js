const fs = require('fs');
const mongoose = require('mongoose')

const calculateScoresItemV1 = require('./src/CalculateScoresV1-Items.js')
const calculateScoresItemV2 = require('./src/CalculateScoresV2-Item.js')

const calculateScoresUser = require('./src/CalculateScoresUsers.js')

// Connect to database
mongoose.connect('mongodb://localhost/pearsons', { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false })
const db = mongoose.connection;
db.on('error', (error) => console.log(error));
db.once('open', () => console.log('Connected to database'));

/* Variables ====================================================== */
const fileName = 'assignment2-ratings-data.txt';
const threshold = 0;
const k = 5;

let n;
let m;

let users = [];
let products = [];

let entryList = []
const matrix = [];
let userResultsMatrix = [];
let itemResultsMatrix = [];

let noScores = []; 
let userAverageScores = [];

const noRating = 0;

/* ReadFile ====================================================== */
async function readFileAndExtractData (fileName) {
    try {
        const data = fs.readFileSync(`./data/${fileName}`, 'UTF-8');
    
        const lines = data.split(/\r?\n/);
    
        lines.forEach(line => {
            if (line != '') {
                entryList.push(line.match(/\S+/g));
            }  
        });
        
        n = parseFloat(entryList[0][0]);
        m = parseFloat(entryList[0][1]);
        
        entryList[1].forEach(user => {
            users.push(user)
        });
        entryList[2].forEach(product => {
            products.push(product)
        });

        for (i = 3; i < entryList.length; i++) {
            let row = [];
            let averageScore = 0;
            let productsRated = 0;

            for (j = 0; j < m; j++) {
                if (entryList[i][j] == noRating) {
                    noScores.push([i-3,j])
                } else {
                    averageScore += parseFloat(entryList[i][j]);
                    productsRated++;
                }
                row.push(parseFloat(entryList[i][j]))
            }
            matrix.push(row)
            userResultsMatrix.push([...row]);
            itemResultsMatrix.push([...row]);
            userAverageScores.push([averageScore/productsRated, productsRated]);
        }
        
    } catch (err) {
        console.error(err);
    }
}

readFileAndExtractData(fileName);

//calculateScoresItemV2(matrix, itemResultsMatrix, userAverageScores, threshold, k, n, m)

//calculateScoresUser(threshold, userAverageScores, matrix, userResultsMatrix, n, m)
