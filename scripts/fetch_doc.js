process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import https from 'https';
import fs from 'fs';

function fetchDoc(url) {
  https.get(url, res => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      fetchDoc(res.headers.location);
      return;
    }
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      fs.writeFileSync('scratch/doc_passwords.txt', data);
      console.log('Saved to scratch/doc_passwords.txt, length:', data.length);
    });
  }).on('error', console.error);
}

fetchDoc('https://docs.google.com/document/d/1gvS9Oa9doStbIg-4W4WNnJu1Wk9ZuZ82RngcyiB2WVk/export?format=txt');
