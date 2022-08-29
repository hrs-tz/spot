const mongoose = require('mongoose');
const { isEmail, isStrongPassword } = require('validator');
const bcrypt = require('bcrypt');
const Visit = require('./visit');
const PositiveCase = require('./positive-case');

const Schema = mongoose.Schema;

// schema for user
const userSchema = new Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Minimum password length is 8 characters'],
        validate: [isStrongPassword, 'Password must contain at least 1 number, 1 special character and 1 capital letter']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        validate: [isEmail, 'Not a valid email']
    }
});

// fire a function before user saved to db - hash password
userSchema.pre('save', async function (next) {
    // check if password is not modified
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt();
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// // fire a function before user deleted from db
// userSchema.pre('deleteOne', { document: false, query: true }, async function(next) {
//     const doc = await this.model.findOne(this.getFilter());
//     await UserLink.deleteMany({ user: doc._id });
//     next();
// });

// static method to login user
userSchema.statics.login = async function(email, password) {
    const user = await this.findOne({ email: email });
    if (user) {
        const auth = await bcrypt.compare(password, user.password);
        if (auth) {
            return user;
        }
        throw Error('incorrect password');
    }
    throw Error('incorrect email');
}

// static method to update user's username and password
userSchema.statics.updateProfile = async function(id, oldPassword, username, password) {
    
    const user = await this.findById(id);

    const auth = await bcrypt.compare(oldPassword, user.password);

    if (auth) {
        if (username) {
            user.username = username;
        }
        if (password) {
            user.password = password;
        }

        try {
            const updatedUser = await user.save();
            return updatedUser;
        } 
        catch (err) {
            throw err;
        }
    }
    throw Error('incorrect password');
}

// model
const User = mongoose.model('User', userSchema);
module.exports = User;