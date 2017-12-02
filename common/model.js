/***
 * @usage :   城市
 * @desc
 */
const mongoose = require('mongoose');
const mongodbClient = require('./mongo');
const Schema = mongoose.Schema;

const HoleSchema = new Schema({
    title: {type: String, required: true},
    cnnvdId: {type: String, required: false},
    cveId: {type: String, required: false},
    publishTime: {type: String, required: false},
    updateTime: {type: String, required: false},
    vulLevel: {type: String, required: false},
    holeType: {type: String, required: false},
    vulType: {type: String, required: false},
    manufacturer: {type: String, required: false},
    source: {type: String, required: false},
    desc: {type: String, required: false},
    notice: {type: String, required: false},
    ref: {type: String, required: false},
    entity: {type: String, required: false},
    bugFix: {type: String, required: false}
});

module.exports = HoleModel = mongodbClient.model('hole', HoleSchema);

