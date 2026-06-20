const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const API_KEY = '6d207e02198a847aa98d0a2a901485a5';
const API_URL = 'https://freeimage.host/api/1/upload';
const IMAGES_DIR = path.join(__dirname, 'images');
const OUTPUT_FILE = path.join(__dirname, 'uploaded-images.json');

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

function uploadImage(filePath) {
  return new Promise((resolve, reject) => {
    const fileBuffer = fs.readFileSync(filePath);
    const base64Image = fileBuffer.toString('base64');
    const fileName = path.basename(filePath);

    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const body = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="key"`,
      '',
      API_KEY,
      `--${boundary}`,
      `Content-Disposition: form-data; name="action"`,
      '',
      'upload',
      `--${boundary}`,
      `Content-Disposition: form-data; name="source"`,
      '',
      base64Image,
      `--${boundary}`,
      `Content-Disposition: form-data; name="format"`,
      '',
      'json',
      `--${boundary}--`,
    ].join('\r\n');

    const bodyBuffer = Buffer.from(body);
    const url = new URL(API_URL);

    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status_code === 200) {
            resolve({
              name: fileName,
              url: json.image.url,
              thumb: json.image.thumb.url,
            });
          } else {
            reject(new Error(`API error for ${fileName}: ${json.status_txt}`));
          }
        } catch {
          reject(new Error(`Failed to parse response for ${fileName}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(bodyBuffer);
    req.end();
  });
}

async function main() {
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error(`Images directory not found: ${IMAGES_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(IMAGES_DIR).filter((f) =>
    IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase())
  );

  if (files.length === 0) {
    console.log('No images found in the images/ directory.');
    return;
  }

  console.log(`Found ${files.length} image(s). Uploading...`);

  const existing = fs.existsSync(OUTPUT_FILE)
    ? JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'))
    : [];

  const existingNames = new Set(existing.map((e) => e.name));
  const results = [...existing];

  for (const file of files) {
    if (existingNames.has(file)) {
      console.log(`  Skipping ${file} (already uploaded)`);
      continue;
    }
    try {
      console.log(`  Uploading ${file}...`);
      const result = await uploadImage(path.join(IMAGES_DIR, file));
      results.push(result);
      console.log(`  Done: ${result.url}`);
    } catch (err) {
      console.error(`  Failed: ${err.message}`);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\nSaved ${results.length} entries to uploaded-images.json`);
}

main();
