
// getting-started.js
const mongoose = require('mongoose');
const Giveaway = require('./models/giveaway');
const Lookingfor = require('./models/lookingfor');

main().catch(err => console.log(err));

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/giveaway');
  
  // use `await mongoose.connect('mongodb://user:password@127.0.0.1:27017/test');` if your database has auth enabled
}

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log("we're connected!")
});

const sample = array => array[Math.floor(Math.random() * array.length)];


// const seedDB = async () => {
//     await Giveaway.deleteMany({});
//     for (let i = 0; i < 10; i++) {
//         const random4 = Math.floor(Math.random() * 4);
//         const random7 = Math.floor(Math.random() * 7);
//         const category = ['book','cycle','phone','chair']
//         const product = ['Wodden Chair','Magazines', 'Toothpaste','Food','Candy','Laundry detergent','Shampoo']

//         const giveaway = new Giveaway({
//             category:category[random4],
//             productName:product[random7],
//             description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Quibusdam dolores vero perferendis laudantium, consequuntur voluptatibus nulla architecto, sit soluta esse iure sed labore ipsam a cum nihil atque molestiae deserunt!',
            
//         })
//         await giveaway.save();
//     }
// }

// seedDB().then(() => {
//     mongoose.connection.close();
// })

const seedDB = async () => {
    await Lookingfor.deleteMany({});
    for (let i = 0; i < 10; i++) {
        const random4 = Math.floor(Math.random() * 4);
        const random7 = Math.floor(Math.random() * 7);
        const category = ['book','cycle','phone','chair']
        const product = ['Wodden Chair','Magazines', 'Toothpaste','Food','Candy','Laundry detergent','Shampoo']

        const lookingfor = new Lookingfor({
            category:category[random4],
            productName:product[random7],
            description: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Quibusdam dolores vero perferendis laudantium, consequuntur voluptatibus nulla architecto, sit soluta esse iure sed labore ipsam a cum nihil atque molestiae deserunt!',
            
        })
        await lookingfor.save();
    }
}

seedDB().then(() => {
    mongoose.connection.close();
})