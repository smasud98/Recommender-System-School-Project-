const mongoose = require('mongoose');

const similarUsersSchema = new mongoose.Schema({
    index: {
        type: Number
    },
    name: {
        type: Number
    },
    users: {
        type: [{
            product: Number,
            coefficient: Number
        }]
    }
})

module.exports = mongoose.model('similarUsers', similarUsersSchema);