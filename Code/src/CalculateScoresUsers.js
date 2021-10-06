const { sluDependencies } = require('mathjs');
const math = require('mathjs');
const mongoose = require('mongoose');

const mAE = require('../functions/MarginOfError.js');

const noRating = 0;

/* ======================================================================================
    Summary: Return an array of the similar users in tuples [coefficient, user]
    @params1 = "threshold": Threshold value
    @params2 = "matrix": The original matrix
    @params3 = "userAverageScores": Average scores of all users
    @params4 = "threshold": Threshold value
    @params5 = "k": Top K neighbours
    @params6 = "n": Number of users
    @params7 = "m": Number of products
====================================================================================== */
const getSimilarUsers = async (entry, matrix, userAverageScores, threshold, k, rA, n, m) => {
    
    let similarUsers = [];

    const userIndex = entry[0];

    for (u = 0; u < n; u++) {
        if (u == userIndex) continue;
        
        let itemA = [];
        let itemI = [];
        let rB = userAverageScores[u][0];

        for (p = 0; p < m; p++) {
            if (matrix[u][p] == noRating || matrix[userIndex][p] == noRating) continue;
            itemA.push(matrix[userIndex][p] - rA);
            itemI.push(matrix[u][p] - rB);
        }
        
        let coefficient;
        try {
            let numerator = math.dot(itemA, itemI);
            let denominator = math.hypot(itemA) * math.hypot(itemI);
            coefficient = parseFloat(numerator/denominator);
        }
        catch (e) {
            continue;
        }

        if (coefficient >= 0)
            similarUsers.push([coefficient, u]);
    }
    var topUsers = similarUsers.sort(sortFirstColumn).slice(-90)
    return topUsers;
}

/* ======================================================================================
    Summary: Calculate the predicted rating then update the result matrix
    @params1 = "entry": The entry we want to update
    @params2 = "rA": Average scores of the user we are looking at
    @params3 = "matrix": The original matrix
    @params4 = "userAverageScores": The average scores of all users
    @params6 = "resultMatrix": The result matrix
    @params7 = "similarUsers": Array of all of the similar users
====================================================================================== */
const predictRating = async (entry, rA, matrix, userAverageScores, resultMatrix, similarUsers) => {
    const userIndex = entry[0];
    const productIndex = entry[1];
    
    let numerator = 0;
    let denominator = 0;

    for (x = 0; x < similarUsers.length; x++) {
        denominator += similarUsers[x][0];

        const rB = userAverageScores[similarUsers[x][1]][0];
        numerator += parseFloat(similarUsers[x][0] * (matrix[x][productIndex] - rB))
    }
    let rating = parseFloat(numerator/denominator) + rA;
    
    if (isNaN(rating) || !isFinite(rating)) rating = rA;
    resultMatrix[userIndex][productIndex] = rating;
}

/* ======================================================================================
    Summary: The main function: Calculate the user similarities, then predict all values, then MAE
    @params1 = "threshold": Threshold value
    @params2 = "userAverageScores": Average scores of all users
    @params3 = "matrix": The original matrix
    @params4 = "resultsMatrix": The result matrix
    @params6 = "n": Number of users
    @params7 = "m": Number of products
====================================================================================== */
const mainFunction = async (threshold, userAverageScores, matrix, resultsMatrix, n, m) => {
    const k = 0;

    for (i = 0; i < n; i++) {
        
        console.log(`At row: ${i}`)       
        for (j = 0; j < m; j++) {
            // If the entry is not rated, then skip
            if (matrix[i][j] == noRating) continue;
            const entry = [i, j];

            // Find similar users
            let rA = parseFloat(((userAverageScores[i][0] * userAverageScores[i][1]) - matrix[i][j])/(userAverageScores[i][1] - 1));
            const similarUsers = await getSimilarUsers(entry, matrix, userAverageScores, threshold, k, rA, n, m);

            // Predict entry value
            await predictRating(entry, rA, matrix, userAverageScores, resultsMatrix, similarUsers);
        }
    }
    const marginOfError = await mAE(matrix, resultsMatrix, noRating, n, m);
    console.log(`Margin of Error: ${marginOfError}`)
}

module.exports = mainFunction





//#region  Sort Functions

function sortByCoefficient(a, b) {
    if (a.coefficient === b.coefficient) {
        return 0;
    }
    else {
        return (a.coefficient < b.coefficient) ? -1 : 1;
    }
}

// Sort by First Column
function sortFirstColumn(a, b) {
    if (a[0] === b[0]) {
        return 0;
    }
    else {
        return (a[0] < b[0]) ? -1 : 1;
    }
}

// Sort by Second Column
function sortSecondColumn(a, b) {
    if (a[1] === b[1]) {
        return 0;
    }
    else {
        return (a[1] < b[1]) ? -1 : 1;
    }
}
//#endregion