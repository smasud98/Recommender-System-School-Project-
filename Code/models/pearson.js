const mongoose = require('mongoose');

const pearsonSchema = new mongoose.Schema({
    index: {
        type: Number
    },
    name: {
        type: Number
    },
    items: {
        type: [{
            product: Number,
            coefficient: Number
        }]
    }
})

module.exports = mongoose.model('pearsons', pearsonSchema);