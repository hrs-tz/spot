const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// schema for visits
const visitSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId, ref: 'User',
        required: true
    },
    poi: {
        type: Schema.Types.ObjectId, ref: 'Poi',
        required: true
    },
    estimation: Number
}, { timestamps: true })

// model
const Visit = mongoose.model('Visit', visitSchema);
module.exports = Visit;