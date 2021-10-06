const math = require('mathjs');

/*
    Summary: Calculate the margin of error
    @params1 value="matrix": The original matrix
    @params2 value="resultsMatrix": The predicted ratings matrix
    @params3 value="n": Number of users
    @params4 value="m": Number of products
*/
const mAE = async (matrix, resultsMatrix, noRating, n, m) => {
    let numerator = 0;
    let denominator = 0;

    for (i = 0; i < n; i++) {
        for (j = 0; j < m; j++) {
            if (matrix[i][j] == noRating) continue;

            numerator += math.abs(resultsMatrix[i][j]-matrix[i][j])
            denominator++;
        }
    }
    return parseFloat(numerator/denominator);
}

module.exports = mAE;