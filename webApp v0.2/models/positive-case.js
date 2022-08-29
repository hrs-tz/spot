const mongoose = require('mongoose');
const { isAfter, isBefore } = require('validator');

const Schema = mongoose.Schema;

// schema for positiveCase
const positiveCaseSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId, ref: 'User',
        required: [true, 'User is required']
    },
    date: {
        type: Date,
        required: [true, 'Date is required'],
        validate: [{
            validator: function(date) {
                const dateStr = date + '';
                return isBefore(dateStr);
            },
            message: 'Invalid date: cannot report positive case for a future date'
        },
        {
            validator: async function(date) {
                const dateStr = date + '';
                const positiveCase = await PositiveCase.find({ user: this.user }).sort({ 'date': -1 }).limit(1);
                if (positiveCase[0]) {
                    let lastDate = positiveCase[0].date;
                    lastDate.setDate(lastDate.getDate() + 14);
                    console.log(lastDate);
                    return isAfter(dateStr, lastDate + '');
                }
                else {
                    return true;
                }
            },
            message: 'Invalid date: cannot report a new positive test within 14 days from last report'
        }]
    },
    testType: {
        type: String,
        required: [true, 'Type is required']
    }
});

// model
const PositiveCase = mongoose.model('PositiveCase', positiveCaseSchema);
module.exports = PositiveCase;