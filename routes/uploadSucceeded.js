var express = require('express');
var router = express.Router();
var util = require('util');

var AWS = require('aws-sdk');
var helpers = require("../helpers");
var Policy = require("../s3post").Policy;
var POLICY_FILE = "policy.json";
var AWS_CONFIG_FILE = "config.json";

/* GET home page. */
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

    var params = {
        Bucket: bucketName,
        Key: req.query.key
    };

    s3.getObject(params, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else {
            var digest = helpers.calculateDigest('sha1', data.Body);
            var simpleDB = new AWS.SimpleDB(awsConfig);

            var params = {
                DomainName: 'walasekawslogs'
            };

            simpleDB.createDomain(params, function(err, data) {
                if (err) console.log('CANNOT CREATE DOMAIN'+ err, err.stack); // an error occurred
                else     console.log('DOMAIN CREATED!'+ data);           // successful response
            });

            console.log('==========-===============' + req.query.key);
            var putParams = {
                Attributes: [ {
                    Name: 'Digest',
                    Value: digest,
                    Replace: false
                },
                ],
                DomainName: 'walasekawslogs',
                ItemName:  req.query.key
            };

            simpleDB.putAttributes(putParams, function(err, data) {
                if (err) console.log('CANNOT PUT ATTRIBUTE' +err, err.stack); // an error occurred
                else {
                    console.log('ATTRIBUTE PUT!' + data);           // successful response
                }
            });
            //
            // var paramsSelect = {
            //     SelectExpression: 'select * from walasekawslogs' /* required */
            // };
            // simpleDB.select(paramsSelect, function(err, data) {
            //     if (err) console.log(err, err.stack); // an error occurred
            //     else  console.log("==============" + util.inspect(data, {showHidden: false, depth: null}));
            // });
        }
    });

    res.redirect('/');
});

module.exports = router;
