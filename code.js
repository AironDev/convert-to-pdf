const {writeFileSync, readFileSync} = require('fs');
const {execSync, spawnSync} = require('child_process');
// const {spawnSync} = require('child_process');
const {parse} = require('path');
const {S3} = require('aws-sdk');

// This code runs only once per Lambda "cold start"
spawnSync(`curl https://s3.amazonaws.com/authoran-lambda-conv/lo.tar.gz -o /tmp/lo.tar.gz && cd /tmp && tar -xf /tmp/lo.tar.gz`);

const s3 = new S3({params: {Bucket: 'authoran-files'}});
const convertCommand = `/tmp/instdir/program/soffice --headless --invisible --nodefault --nofirststartwizard --nolockcheck --nologo --norestore --convert-to pdf --outdir /tmp`;

exports.handler = async ({filename}) => {
  const {Body: inputFileBuffer} = await s3.getObject({Key: filename}).promise();
  // writeFileSync(`/tmp/${filename}`, inputFileBuffer);
  
  try{  
      writeFileSync('/tmp/'+filename, inputFileBuffer);
    } catch(err) {
      // An error occurred
      console.error('file write:', err);
    }

  spawnSync(`cd /tmp && ${convertCommand} ${filename}`);
  
  try {
      console.log(execSync(convertCommand).toString('utf8'));
    } catch (e) {
      console.log(execSync(convertCommand).toString('utf8'));
    }
    console.log(execSync('ls -alh /tmp').toString('utf8'));

  const outputFilename = `${parse(filename).name}.pdf`;
  const outputFileBuffer = readFileSync(`/tmp/${outputFilename}`);

  await s3
    .upload({
      Key: outputFilename, Body: outputFileBuffer,
      ACL: 'public-read', ContentType: 'application/pdf'
    })
    .promise();
  
  // return readFileSync(`/tmp/${filename}`)

  return `https://s3.amazonaws.com/lambda-libreoffice-demo/${outputFilename}`;
};