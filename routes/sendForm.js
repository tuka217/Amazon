var express = require('express');
var router = express.Router();
var util = require('util');

var AWS = require('aws-sdk');
var helpers = require("../helpers");
var Policy = require("../s3post").Policy;
var S3Form = require("../s3post").S3Form;
var AWS_CONFIG_FILE = "config.json";
var POLICY_FILE = "policy.json";

router.get('/', function(req, res, next) {
    //1. load configuration
    var awsConfig = helpers.readJSONFile(AWS_CONFIG_FILE);
    var policyData = helpers.readJSONFile(POLICY_FILE);

    //2. prepare policy
    var policy = new Policy(policyData);

    //3. generate form fields for S3 POST
    var s3Form = new S3Form(policy);
    //4. get bucket name
    var bucketName = policy.getConditionValueByKey("bucket");

    var fields = s3Form.generateS3FormFields();
    fields = s3Form.addS3CredientalsFields(fields, awsConfig);

    AWS.config.update({
        accessKeyId: awsConfig.accessKeyId,
        secretAccessKey: awsConfig.secretAccessKey,
        "region": awsConfig.region
    });

    //log to simpleDB

    var simpleDB = new AWS.SimpleDB(awsConfig);

    var params = {
        DomainName: 'walasekawslogs'
    };

    simpleDB.createDomain(params, function(err, data) {
        if (err) console.log('CANNOT CREATE DOMAIN'+ err, err.stack); // an error occurred
        else     console.log('DOMAIN CREATED!'+ data);           // successful response
    });

    var putParams = {
        Attributes: [ {
            Name: 'Get from submit image',
            Value: new Date().toISOString(),
            Replace: false
        },
        ],
        DomainName: 'walasekawslogs',
        ItemName: 'getFormToSendFileEvent ' + new Date().toISOString()
    };

    simpleDB.putAttributes(putParams, function(err, data) {
        if (err) console.log('CANNOT PUT ATTRIBUTE ABOUT GET ACTION' +err, err.stack); // an error occurred
        else {
            console.log('ATTRIBUTE PUT ABOUT GET ACTION!' + data);           // successful response
        }
    });

    res.render('sendForm', {
        title: 'Send file',
        fields:fields,
        bucket:bucketName
    });
});

module.exports = router;
