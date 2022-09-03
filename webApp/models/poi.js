const mongoose = require('mongoose');
const Visit = require('./visit');
const Schema = mongoose.Schema;

// schema for coordinates
const CoordinatesSchema = new Schema({
    lng: {
        type: Number,
        required: true
    },
    lat: {
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
        lng: {
            type: Number,
            required: true
        },
        lat: {
            type: Number,
            required: true
        }
    },
    rating: Number,
    rating_n: Number,
    current_popularity: Number,
    populartimes: {
        type: [PopulartimesSchema],
        required: true
    },
    time_spent: [Number]
}, { timestamps: true });

poiSchema.index({ "coordinates": "2d" });

// fire a function after all pois deleted from db - delete all visits
poiSchema.post('deleteMany', async function (doc, next) {
    await Visit.deleteMany({});
    next();
});

// static method to insert/update pois
poiSchema.statics.uploadPois = async function(pois) {

    let forUpdate = [];
    let forInsert = [];

    if (pois.length){
        for (let poi of pois){
            const dbPoi = await Poi.findOne({ id: poi.id });
            if (dbPoi) {
                dbPoi.id = poi.id;
                dbPoi.name = poi.name;
                dbPoi.address = poi.address;
                dbPoi.types = poi.types;
                dbPoi.coordinates = poi.coordinates;
                dbPoi.rating = poi.rating;
                dbPoi.rating_n = poi.rating_n;
                if (poi.current_popularity) {
                    dbPoi.current_popularity = poi.current_popularity;
                }
                dbPoi.populartimes = poi.populartimes;
                if (poi.time_spent) {
                    dbPoi.time_spent = poi.time_spent;
                }
                forUpdate.push(dbPoi);
            }
            else {
                forInsert.push(poi);
            }
        }
        try {
            await Poi.bulkSave(forUpdate);
            await Poi.insertMany(forInsert);
            return true;
        }
        catch (err) {
            throw Error('file not in the correct form. Try another file...')
        }
    }
    throw Error('empty file. Try another file...');
}

// model
const Poi = mongoose.model('Poi', poiSchema);
module.exports = Poi;

