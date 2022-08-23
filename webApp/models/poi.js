const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// schema for coordinates
const CoordinatesSchema = new Schema({
    lat: {
        type: Number,
        required: true
    },
    lng: {
        type: Number,
        required: true
    }
});

// schema for popular times
const PopulartimesSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    data: {
        type: [Number],
        required: true
    }
});

// schema for poi
const poiSchema = new Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    types: {
        type: [String],
        required: true
    },
    coordinates: {
        type: CoordinatesSchema,
        required: true
    },
    rating: {
        type: Number,
        required: true
    },
    rating_n: {
        type: Number,
        required: true
    },
    current_popularity: Number,
    populartimes: {
        type: [PopulartimesSchema],
        required: true
    },
    time_spent: [Number]
}, { timestamps: true });


// model
const Poi = mongoose.model('Poi', poiSchema);
module.exports = Poi;

