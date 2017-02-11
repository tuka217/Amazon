var express = require('express');
var router = express.Router();

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

    res.render('sendForm', {
        title: 'Send file',
        fields:fields,
        bucket:bucketName
    });
});

module.exports = router;
