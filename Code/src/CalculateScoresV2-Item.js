const math = require('mathjs');
const mongoose = require('mongoose');

const Pearson = require('../models/pearson.js');
const mAE = require('../functions/MarginOfError.js');

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
            if (matrix[i][j] == noRating) {
                row[j] = null;
            } else {
                row[j] = parseFloat((matrix[i][j] - userAverageScores[i][0]));
            }
        }
        returnMatrix.push(row)
    }
    return returnMatrix;
}

/* ======================================================================================
    Summary: Calculate the top similar items for the specified item
    @params1 = "productIndex": The index of the product we are calculating similarities for
    @params2 = "adjustedCosineMatrix": The adjusted cosine matrix
    @params3 = "threshold": The coefficient threshold
    @params4 = "k": Top K neighbours
    @params5 = "n": Number of users
    @params6 = "m": Number of products
    Returns: An array of objects representing each similar item ({ product, coefficient })
====================================================================================== */
async function calculateItemsSimilarity (productIndex, adjustedCosineMatrix, threshold, k, n, m) {
    let itemSimilarity = [];

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
            //console.log(`In Catch of Calculate Item Similarity: ${p} : Error: ${e.message}`)
            continue;
        }
        if (similarity >= threshold) {
            const item = {
                product: p,
                coefficient: similarity
            }
            itemSimilarity.push(item);
        }
    }
    // Top K
    var topSimilarities = itemSimilarity.sort(sortByCoefficient).slice(-k); 
    return topSimilarities;
}

/* ======================================================================================
    Summary: Calculate similarities for each item
    @params1 = "itemToRate": The [user, item] of the item we want to predict
    @params2 = "matrix": The original matrix
    @params3 = "itemsResultMatrix": Modified here at entry itemToRate
    Updates the itemResultMAtrix
====================================================================================== */
async function predictRating (itemToRate, matrix, itemsResultMatrix, averageScore) {
    let numerator = 0;
    let denominator = 0;

    const userIndex = itemToRate[0];
    const productIndex = itemToRate[1];

    try {
        const similarItemsObjects = await Pearson.findOne({index: productIndex});
        const similarItems = similarItemsObjects.items;

        for (i = 0; i < similarItems.length; i++) {
            const rUI = matrix[userIndex][similarItems[i].product];
            if (rUI == noRating) continue;
    
            const similarity = similarItems[i].coefficient;
            denominator += similarity;
    
            numerator += similarity * rUI;
        }
        let score = parseFloat(numerator / denominator);
    
        if (isNaN(score) || !isFinite(score)) score = averageScore;
    
        itemsResultMatrix[userIndex][productIndex] = score;
    }
    catch (e) {
        //console.log(`ProductIndex: ${productIndex}`)
        console.log(e.message)
    }
}


/* ======================================================================================
    Summary: Calculate similarities all item
    @params1 = "adjustedCosineMatrix": The adjusted cosine matrix
    @params2 = "k": Top number of neighbours
    @params3 = "threshold": Threshold value
    @params4 = "n": Number of users
    @params5 = "m": Number of products
====================================================================================== */
async function calculateAllSimilarities (adjustedCosineMatrix, k, threshold, n, m) {
    for (col = 0; col < m; col++) {

        // Return array objects: product, coefficient *** 
        const itemSimilarities = await calculateItemsSimilarity(col, adjustedCosineMatrix, threshold, k, n, m); 

        try {
            // Add to items attribute
            const pearsonEntry = new Pearson({
                index: col,
                items: itemSimilarities
            });
            await pearsonEntry.save()
        }
        catch (e) {
            console.log(`Failed on entry: [${col}]`)
        }
    }
}

/* ======================================================================================
    Summary: The main function: Calculate the adjusted Cosine Matrix, then all the similarities, then predict all values, then MAE
    @params1 = "matrix": The original matrix
    @params2 = "itemsResultMatrix": Not modified here, will be passed to later function
    @params3 = "userAverageScores": Average scores for each user
    @params4 = "threshold": Threshold value
    @params5 = "k": Top number of neighbours
    @params6 = "n": Number of users
    @params7 = "m": Number of products
====================================================================================== */
const mainFunction = async (matrix, itemResultsMatrix, userAverageScores, threshold, k, n, m) => {

    // Calculate Adjusted Cosine Matrix
    const adjustedCosineMatrix = await calculateAdjustedCosineMatrix(matrix, userAverageScores, n, m);

    // For each item, calculate the similarities and put them in an array
    await calculateAllSimilarities(adjustedCosineMatrix, k, threshold, n, m)

    for (user = 0; user < n; user++) {
        for (item = 0; item < m; item++) {
            const entry = [user, item]
            // If no rating
            if (matrix[user][item] == noRating) continue;
            
            // Predict score for each entry: First adjust user average score
            let newAverageScore = ((userAverageScores[user][0] * userAverageScores[user][1]) - matrix[user][item])/userAverageScores[user][1]-1;
            await predictRating(entry, matrix, itemResultsMatrix, newAverageScore);
        }
    }

    const marginOfError = await mAE(matrix, itemResultsMatrix, noRating, n, m);
    console.log("Margin of Error: " + marginOfError)
}


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

module.exports = mainFunction;