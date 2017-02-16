var express = require('express');
var router = express.Router();
var AWS = require('aws-sdk');
var amazon = require('../AmazonHelper');
var helpers = require("../helpers");
var Policy = require("../s3post").Policy;
var POLICY_FILE = "policy.json";
var s3URL = "https://s3-us-west-2.amazonaws.com/rusek-bucket/"
var prefix = "photos/";
var AWS_CONFIG_FILE = "config.json";

router.get('/', function(req, res, next) {
    var awsConfig = helpers.readJSONFile(AWS_CONFIG_FILE);
    var policyData = helpers.readJSONFile(POLICY_FILE);
    //2. prepare policy
    var policy = new Policy(policyData);
    //4. get bucket name
    var bucketName = policy.getConditionValueByKey("bucket");

    AWS.config.update({
        accessKeyId: awsConfig.accessKeyId,
        secretAccessKey: awsConfig.secretAccessKey,
        "region": awsConfig.region
    });

    var s3 = new AWS.S3();
    var imagesList = [];

    var params = {
        Bucket: bucketName,
        Delimiter: ';',
        EncodingType: 'url',
        MaxKeys: 1000,
        Prefix: prefix
    };

    s3.listObjectsV2(params, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else {
            for (var i = 1; i < data.Contents.length; i++) {
                imagesList.push(s3URL + data.Contents[i].Key);
            }

            res.render('gallery', {
                imagesList: imagesList,
                title: 'Gallery'
            });
        }
    });
});

router.post('/', function(req, res, next) {
    var processedArray = [];
    for (var key in req.body) {
        item = req.body[key];
        processedArray.push(item);
    }
    if (processedArray.length > 4) {
        var message = "Cannot process mor than 10 elements at once";
        amazon.putLog(message, new Date().toISOString(), "CapacityError");
        res.locals.message = message;
        res.locals.error = {};

        // render the error page
        res.status(500);
        res.render('error');
    } else {
        amazon.putMesagesToQueue(processedArray);
        console.log(processedArray);
        res.redirect('/gallery');
    }
});

module.exports = router;