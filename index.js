const path = require('path');
const fs = require('fs');
const watermark = require('image-watermark');
var async = require('async');
const {writeFileSync} = require('fs');
const lambdafs = require('lambdafs');
const {execSync} = require('child_process');
const {S3} = require('aws-sdk');

const inputPath = path.join( '/opt', 'lo.tar.br'); 
const outputPath = '/tmp/';
const bucketName = process.env.SOURCE_BUCKET;

module.exports.handler = async ({fileUrl, returnRaw,  Records} ) => {
execSync('ls -alh /opt').toString('utf8');
  try {
    // Decompress Libreoffice
    let decompressed = {
      file: await lambdafs.inflate(inputPath)
    };
    console.log('Success brotli decompressed'); 
  } catch (error) {
    console.log('Error brotli de:----', error);
  }
  
  try {
    execSync('ls -alh /opt'); 
  } catch (e) {
    console.log(e);
  }

  // get file from s3 bucket
  if(Records){
    console.log('Object Event running ' + Records.toString('utf8')); 
    var records = Records
    var s3fileName = decodeURIComponent( records[0].s3.object.key.replace(/\+/g, ' '));
    console.log('S3 triggered Event running ' + s3fileName); 
  }else{
    var s3fileName = fileUrl;
    console.log('Manual event triggered ' + s3fileName); 
  }
  
  var newFileName = Date.now()+'.pdf';
  const s3 = new S3();
  var fileStream = fs.createWriteStream('/tmp/'+s3fileName);
  var getObject = function(keyFile) {
      return new Promise(function(success, reject) {
          s3.getObject(
              { Bucket: bucketName, Key: keyFile },
              function (error, data) {
                  if(error) {
                      reject(error);
                  } else {
                      success(data);
                  }
              }
          );
      });
  }
  // store file to be converted inside lambda tmp
  let fileData = await getObject(s3fileName);
    try{  
      fs.writeFileSync('/tmp/'+s3fileName, fileData.Body);
    } catch(err) {
      // An error occurred
      console.error('file write:', err);
    }

    // execute file conversion
    const convertCommand = `export HOME=/tmp && /tmp/lo/instdir/program/soffice.bin --headless --norestore --invisible --nodefault --nofirststartwizard --nolockcheck --nologo --convert-to "pdf:writer_pdf_Export" --outdir /tmp /tmp/${s3fileName}`;
    try {
      console.log(execSync(convertCommand).toString('utf8'));
    } catch (e) {
      console.log(execSync(convertCommand).toString('utf8'));
      console.log('Error occurred while converting document ' + e);
    }
    // console log  contents of /tmp
    console.log(execSync('ls -alh /tmp').toString('utf8'));



    // upload converted document to s3
    function uploadFile(buffer, fileName) {
     return new Promise((resolve, reject) => {
      s3.putObject({
       Body: buffer,
       Key: fileName,
       Bucket: process.env.DESTINATION_BUCKET,
      }, (error) => {
       if (error) {
        reject(error);
       } else {
        resolve(fileName);
       }
      });
     });
    }

    let fileParts = s3fileName.substr(0, s3fileName.lastIndexOf(".")) + ".pdf";
    let fileB64data = fs.readFileSync('/tmp/'+fileParts);

    // add watermark
    try{
        watermark.embedWatermark('/tmp/'+fileParts, {'text': 'downloaded from authoran.com'});
    }catch(e){
      console.log("unable to add watermark", e)
    }

    if(returnRaw){
      return fileB64data
    }else{
      await uploadFile(fileB64data, fileParts);
       // Host-Style Naming: http://mybucket.s3-us-west-2.amazonaws.com
      // Path-Style Naming: http://s3-us-west-2.amazonaws.com/mybucket
      // https://authoran-files.s3.eu-west-2.amazonaws.com/example.pdf
      let uploadedFileUrl =  `https://${process.env.DESTINATION_BUCKET_REGION}.s3-eu-west-2.amazonaws.com/${fileParts}`
      console.log('new pdf converted and uploaded!!! ' + uploadedFileUrl);
      return uploadedFileUrl
    }  
};