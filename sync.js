const fs    = require('fs');
const path  = require('path');
const axios = require('axios');

// Allow passing a single CARD_ID argument from GitHub Actions
const targetCardId = process.argv[2];

// Label-to-UTM mapping
const mapping = {
  facebook: { source: 'FTE', medium: 'facebook' },
  display:  { source: 'FTE', medium: 'display'  },
  tiktok:   { source: 'FTE', medium: 'tiktok'   },
  audio:    { source: 'FTE', medium: 'audio'    },
};

// Fetch either one card or all cards
async function getCards() {
  if (targetCardId) {
    // Single card endpoint
    const url = `https://api.trello.com/1/cards/${targetCardId}?customFieldItems=true&fields=name,desc,labels,url`;
    const resp = await axios.get(url, {
      params: { key: process.env.TRELLO_KEY, token: process.env.TRELLO_TOKEN }
    });
    return [resp.data];
  } else {
    // Board-wide fetch
    const url = `https://api.trello.com/1/boards/${process.env.TRELLO_BOARD_ID}/cards?customFieldItems=true&fields=name,desc,labels,url`;
    const resp = await axios.get(url, {
      params: { key: process.env.TRELLO_KEY, token: process.env.TRELLO_TOKEN }
    });
    return resp.data;
  }
}

async function run() {
  const cards = await getCards();
  for (let card of cards) {
    // Determine UTM mapping from labels
    const labels = card.labels.map(l => l.name.toLowerCase());
    const match  = labels.find(l => mapping[l]);
    if (!match) {
      console.warn(`Skipping ${card.id}: no matching label`);
      continue;
    }

    const { source, medium } = mapping[match];

    // Read "Client" custom field
    const clientField = (card.customFieldItems || [])
      .find(f => f.name === 'Client');
    if (!clientField?.value?.text) {
      console.warn(`Skipping ${card.id}: no Client field`);
      continue;
    }
    const clientName = clientField.value.text;
    const folder     = path.join(__dirname, 'clients', clientName);
    fs.mkdirSync(folder, { recursive: true });

    // Write card data to JSON file
    const outData = {
      id:         card.id,
      name:       card.name,
      desc:       card.desc,
      url:        card.url,
      utm_source: source,
      utm_medium: medium,
      labels:     labels
    };
    fs.writeFileSync(
      path.join(folder, `${card.id}.json`),
      JSON.stringify(outData, null, 2)
    );

    // Send to Adpiler
    try {
      await axios.post(
        'https://api.adpiler.com/v1/campaigns',
        {
          name:       card.name,
          content:    card.desc,
          utm_source: source,
          utm_medium: medium
        },
        { headers: { Authorization: `Bearer ${process.env.ADPILER_API_KEY}` } }
      );
    } catch (e) {
      console.error('Adpiler error for card', card.id, e.response?.data || e);
    }
  }
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
