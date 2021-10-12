const path = require('path');
const fs = require('fs');
var async = require('async');
const {writeFileSync} = require('fs');
const lambdafs = require('lambdafs');
const {execSync, spawnSync, spawn} = require('child_process');
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
    
  // var newFileName = Date.now()+'.pdf';
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
    const convertCommand = await `export HOME=/tmp && /tmp/lo/instdir/program/soffice.bin --headless --norestore --invisible --nodefault --nofirststartwizard --nolockcheck --nologo --convert-to "pdf:writer_pdf_Export" --outdir /tmp /tmp/${s3fileName}`;
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


    if(returnRaw){
      return fileB64data
    }else{
      await uploadFile(fileB64data, fileParts);
       // Host-Style Naming: http://mybucket.s3-us-west-2.amazonaws.com
      // Path-Style Naming: http://s3-us-west-2.amazonaws.com/mybucket
      // https://authoran-files.s3.eu-west-2.amazonaws.com/example.pdf
      let uploadedFileUrl =  `https://${process.env.DESTINATION_BUCKET}.s3-${process.env.DESTINATION_BUCKET_REGION}.amazonaws.com/${fileParts}`
      console.log('new pdf converted and uploaded!!! ' + uploadedFileUrl);
      // return uploadedFileUrl
    }


  try{
  // use stamp to cover the content completely
  // use background to add the back.pdf as background to pdf

  // Remove page 13 from in1.pdf to create out1.pdf
  // pdftk in.pdf cat 1-12 14-end output out1.pdf
  // or: pdftk A=in1.pdf cat A1-12 A14-end output out1.pdf

  // if you want to extract random pages:
  // pdftk myoldfile.pdf cat 1 2 4 5 output mynewfile.pdf

  // if you want to extract a range:
  // pdftk myoldfile.pdf cat 1-2 4-5 output mynewfile.pdf
  const NUMBEROFPAGES = (execSync(`pdftk ${fileData} dump_data | grep NumberOfPages | awk '{print $2} `).toString('utf8'));
  console.log(NUMBEROFPAGES)
  execSync(`pdftk ${fileData} stamp  ${fileData} output tmp/outed.pdf`, (error, stdout, stderr) => {
      if (error || stderr)
          reject(error);
      else
          fulfill(placeholderStampPdf);
  });

  }catch(e){
    console.log("unable to add watermark" +e)
  }

  // console log  contents of /tmp
  console.log(execSync('ls -alh /tmp').toString('utf8'));

};

