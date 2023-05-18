const mongoose = require("mongoose")
const Review = require("./review")
const passportLocalMongoose = require("passport-local-mongoose")

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    reviews:[
        {
        type:mongoose.Schema.Types.ObjectId,
        ref:'Review'
        }
    ],
    isVerified:{
        type:Number,
        default:0,
        enum:[0,1]
    },
    sentRequest:[{
        // userId: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
         username: {type: String, default: ''}
     }],
     request: [{
         userId: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
         username: {type: String, default: ''}
     }],
     friendsList: [{
         friendId: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
         friendName: {type: String, default: ''}
     }]
})

UserSchema.plugin(passportLocalMongoose);

const User = mongoose.model("User",UserSchema)

module.exports = User