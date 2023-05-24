const mongoose = require('mongoose')
const Review = require("./review")

const lookingforSchema = new mongoose.Schema({
    category:{
        type:String,
        required:true,
    },
    productName:{
        type:String,
        required:true
    },
    city:{
        type:String,
        required:true
    },
    state:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    image:{
        url:String,
        filename:String
    },
    reviews:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Review'
    }],
    author:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
       }
})


lookingforSchema.post('findOneAndDelete',async function (doc){
    if (doc) {
        await Review.deleteMany({
            _id: {
                $in: doc.reviews
            }
        })
    }
})

const Lookingfor = mongoose.model('Lookingfor',lookingforSchema)
 
module.exports =Lookingfor