const math = require('mathjs');

const mAE = require('../functions/MarginOfError.js')

const noRating = 0;

/* ======================================================================================
    Summary: Calculate the AdjustedCosineMatrix
    @params1 = "matrix": The original matrix
    @params2 = "userAverageScores": The user average scores used to compute original adjusted cosine matrix
    @params3 = "n": Number of users
    @params3 = "m": Number of products
    Calculate the AdjustedCosineMatrix
====================================================================================== */
async function calculateAdjustedCosineMatrix(matrix, userAverageScores, n, m) {
    let returnMatrix = [];

    for (i = 0; i < n; i++) {
        let row = [...matrix[i]];

        for (j = 0; j < m; j++) {
            if (matrix[i][j] <= noRating) {
                row[j] = null;
            } else {
                row[j] = parseFloat((matrix[i][j] - userAverageScores[i][0])); // Added [0]
            }
        }
        returnMatrix.push(row)
    }
    return returnMatrix;
}

/* ======================================================================================
    Summary: Find the average of the user given the specified findScore to exclude
    @params1 = "matrix": The original matrix
    @params2 = "findScore": Tuple [UserIndex, ProductIndex]
    @params3 = "m": Number of products
    Calculate the average for the user
====================================================================================== */
async function findAverage(matrix, findScore, averageScores) {
    const userIndex = findScore[0];
    const productIndex = findScore[1];

    let average = averageScores[userIndex][0];
    let productsRated = averageScores[userIndex][1];

    let sum = (average * productsRated) - matrix[userIndex][productIndex];
    productsRated--;

    return parseFloat(sum / productsRated);
}


/* ======================================================================================
    Summary: Modify the one row of the adjusted cosine matrix
    @params1 = "matrix": The original matrix
    @params2 = "noScore": Tuple [UserIndex, ProductIndex]
    @params3 = "m": Number of products
    Adjust the AdjustedCosineMatrix
====================================================================================== */
async function modifyAdjustedCosineMatrix(matrix, noScore, averageScore, m) {
    const userIndex = noScore[0];
    const productIndex = noScore[1];

    let row = [];

    // Adjust row
    for (y = 0; y < m; y++) {
        if (y == productIndex || matrix[userIndex][y] == noRating) row.push(null);
        else {
            row.push(matrix[userIndex][y] - averageScore);
        }
    }
    return row;
}


/* ======================================================================================
    Summary: Calculate similar items for the specific findScore tuple
    @params1 = "findScore": Tuple [UserIndex, ProductIndex]
    @params2 = "adjustedCosineMatrix": The AdjustedCosineMatrix of the given findScore tuple
    @params3 = "threshold": Up to 5 items
    @params4 = "itemsResultMatrix": Not modified here, will be passed to predictScore function
    @params5 = "matrix": The original matrix, not modified here, will be passed to predictScore function
    Produces an array of tuples of the topSimilarities to pass to predictScore function
====================================================================================== */
async function calculateItemsSimilarity(findScore, adjustedCosineMatrix, threshold, itemResultsMatrix, matrix, averageScore, m, n) {
    let similarityArray = [];

    const userIndex = findScore[0];
    const productIndex = findScore[1];

    for (p = 0; p < m; p++) {
        if (p == productIndex) continue;

        let itemP = [];
        let itemA = [];

        for (u = 0; u < n; u++) {
            if (adjustedCosineMatrix[u][p] == null || adjustedCosineMatrix[u][productIndex] == null) continue;

            itemA.push(adjustedCosineMatrix[u][productIndex]);
            itemP.push(adjustedCosineMatrix[u][p]);
        }
        let similarity;
        try {
            const numerator = math.dot(itemA, itemP);
            const denominator = math.hypot(itemA) * math.hypot(itemP);
            similarity = parseFloat((numerator / denominator));
        } catch (e) {
            continue;
        }

        if (similarity >= 0 && matrix[userIndex][p] != noRating) {
            similarityArray.push([similarity, p]);
        }
    }
    var topSimilarities = similarityArray.sort(sortFirstColumn).slice(-threshold);

    await predictScore(topSimilarities, itemResultsMatrix, findScore, matrix, averageScore);
}


/* ======================================================================================
    Summary: Calculate score for specified findScore item
    @params1 = "topSimilarities": An array of tuples of the topSimilarities [Similarity, ProductIndex]
    @params2 = "itemResultsMatrix": Modify the [UserIndex, ProductIndex] index of this with the score
    @params3 = "findScore": Tuple [UserIndex, ProductIndex]
    @params4 = "matrix": The original matrix
    Produces an array of tuples of the topSimilarities to pass to predictScore function
====================================================================================== */
async function predictScore(topSimilarities, itemResultsMatrix, findScore, matrix, averageScore) {
    let numerator = 0;
    let denominator = 0;

    const userIndex = findScore[0];
    const productIndex = findScore[1];

    for (a = 0; a < topSimilarities.length; a++) {
        const similarity = topSimilarities[a][0];
        denominator += similarity;

        const rUI = matrix[userIndex][topSimilarities[a][1]];
        numerator += similarity * rUI;
    }
    let score = parseFloat(numerator / denominator);

    if (isNaN(score) || !isFinite(score)) score = averageScore;

    itemResultsMatrix[userIndex][productIndex] = score;
}


/* ======================================================================================
    Summary: Main function of the module: 
        - First compute adjustedCosineMatrix
        - For every valid matrix item, compute the modified adjustedCosineMatrix
        - Calculate the similiarities which would call the predict scores function
        - Output the final result matrix
    @params1 = "matrix": The original matrix
    @params2 = "itemResultsMatrix": The final result matrix
    @params3 = "userAverageScores": The user average scores used to compute original adjusted cosine matrix
    @params4 = "threshold" The threshold (Here it equals 5)
    @params5 = "n": Number of users
    @params6 = "m": Number of products
    Produces the final results matrix
====================================================================================== */
async function calculateScores(matrix, itemResultsMatrix, userAverageScores, threshold, n, m) {
    let adjustedCosineMatrix = await calculateAdjustedCosineMatrix(matrix, userAverageScores, n, m);

    for (i = 0; i < n; i++) {
        console.log("Begin Row: " + i)
        for (j = 0; j < m; j++) {
            if (matrix[i][j] == noRating) continue;
            const findScore = [i, j];

            const originalR = [...adjustedCosineMatrix[i]];

            // Adjust row for Cosine Matrix
            const averageScore = await findAverage(matrix, findScore, userAverageScores);
            const newRow = await modifyAdjustedCosineMatrix(matrix, findScore, averageScore, m);

            adjustedCosineMatrix[i] = newRow;

            //Calculate Similarities: (Adjusted Matrix, threshold, resultMatrix) => Predict Score: (matrix, resultMatrix)
            await calculateItemsSimilarity(findScore, adjustedCosineMatrix, threshold, itemResultsMatrix, matrix, averageScore, m, n);

            // Set adjustedCosineMatrix back to normal
            adjustedCosineMatrix[i] = originalR;
        }
        console.log("Row complete")
    }

    const meanError = await mAE(matrix, itemResultsMatrix, noRating, n, m);
    console.log(meanError)
}


//#region  Sort Functions

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

module.exports = calculateScores;