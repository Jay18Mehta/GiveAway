const mongoose = require('mongoose')
const Review = require("./review")

// const ImageSchema = new mongoose.Schema({
//     url: String,
//     filename: String
// });

// ImageSchema.virtual('thumbnail').get(function () {
//     return this.url.replace('/upload','/upload/w_200');
// });

const giveawaySchema = new mongoose.Schema({
    category:{
        type:String,
        required:true,
        // enum:['book','cycle','phone','chair']
    },
    productName:{
        type:String,
        required:true
    },
    // image:{ImageSchema},
    image:{
        url:String,
        filename:String
    },
    description:{
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
    reviews:[
        {
        type:mongoose.Schema.Types.ObjectId,
        ref:'Review'
        }
   ],
   author:{
    type:mongoose.Schema.Types.ObjectId,
    ref:'User'
   }
})


giveawaySchema.post('findOneAndDelete',async function (doc){
    if (doc) {
        await Review.deleteMany({
            _id: {
                $in: doc.reviews
            }
        })
    }
})
const Giveaway = mongoose.model('Giveaway',giveawaySchema)
 
module.exports =Giveaway

