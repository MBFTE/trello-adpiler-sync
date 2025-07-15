// Trello ➜ AdPiler GitHub Automation (Node.js)
// Supports: GIFs, zipped HTML5, PNG/JPG, MP4

const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
const TRELLO_LIST_ID = process.env.TRELLO_LIST_ID; // ID of "Ready for AdPiler" list

const ADPILER_API_KEY = process.env.ADPILER_API_KEY;
const ADPILER_CLIENT_ID = process.env.ADPILER_CLIENT_ID;
const ADPILER_CAMPAIGN_ID = process.env.ADPILER_CAMPAIGN_ID;

const logFile = 'upload-log.json';

async function getCardsFromTrello() {
  const url = `https://api.trello.com/1/lists/${TRELLO_LIST_ID}/cards?attachments=true&key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`;
  const { data } = await axios.get(url);
  return data;
}

function isSupportedFile(fileName) {
  return /\.(gif|png|jpg|jpeg|mp4|zip)$/i.test(fileName);
}

async function uploadToAdpiler(card, attachment) {
  const payload = {
    title: card.name,
    platform: 'auto',
    client_id: ADPILER_CLIENT_ID,
    campaign_id: ADPILER_CAMPAIGN_ID,
    creative_type: 'auto',
    creative_url: attachment.url
  };

  const response = await axios.post('https://platform.adpiler.com/api/v1/creatives', payload, {
    headers: {
      Authorization: `Bearer ${ADPILER_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
}

async function runUploader() {
  const cards = await getCardsFromTrello();
  const log = [];

  for (const card of cards) {
    if (!card.attachments || card.attachments.length === 0) continue;

    for (const attachment of card.attachments) {
      if (!isSupportedFile(attachment.name)) continue;

      try {
        const result = await uploadToAdpiler(card, attachment);
        log.push({ card: card.name, file: attachment.name, status: '✅ Uploaded', result });

        // Optional: Add comment to Trello card
        await axios.post(`https://api.trello.com/1/cards/${card.id}/actions/comments`, {
          text: `✅ Uploaded ${attachment.name} to AdPiler.`
        }, {
          params: {
            key: TRELLO_API_KEY,
            token: TRELLO_TOKEN
          }
        });

      } catch (err) {
        log.push({ card: card.name, file: attachment.name, status: '❌ Failed', error: err.message });
      }
    }
  }

  fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
  console.log(`✅ Upload complete. Log written to ${logFile}`);
}

runUploader().catch(console.error);
