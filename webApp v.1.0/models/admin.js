const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcrypt');

// schema for admin
const adminSchema = new Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true
    },
    password: {
        type: String,
        required: [true, 'Password is required']
    }
});

// fire a function before admin saved to db - hash password
adminSchema.pre('save', async function (next) {
    // check if password is not modified
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt();
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// static method to login admin
adminSchema.statics.login = async function(username, password) {
    const admin = await this.findOne({ username: username });
    if (admin) {
        const auth = await bcrypt.compare(password, admin.password);
        if (auth) {
            return admin;
        }
        throw Error('incorrect password');
    }
    throw Error('incorrect username');
}

// model
const Admin = mongoose.model('Admin', adminSchema);
module.exports = Admin;