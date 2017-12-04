/***
 * db
 */
const mongoose = require('mongoose');
const logger   = require('./log');


mongoose.Promise = global.Promise;


const mongodbClient = mongoose.createConnection(`mongodb://localhost:27017/cnnvd`);

mongodbClient.on('error', (error) => {
    logger.error("error from mongodbClient-->" + error)
});
mongodbClient.on("open", () => {
    logger.info("successfully opened the mongodbClient!")
});

module.exports = mongodbClient;