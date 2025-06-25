const express = require('express');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

// Load Mongoose model
const ProductOrder = require('./models/ProductOrder');

// MongoDB Connection
const MONGO_URI =
  "mongodb+srv://rukshan:ran12345@cluster0.gbrxc7t.mongodb.net/product_order_db?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log("✅ MongoDB Connected");
    
  })
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Middleware to log every incoming request
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.originalUrl}`);
  next();
});

// CORS Setup - Allow specific origin
const allowedOrigin = 'http://localhost:5173'; // Your frontend origin

app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Accept']
}));

// Preflight handler
app.options(/^\/tmf-api\/.*$/, (req, res) => {
  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.sendStatus(204); // No content for preflight
});

// Validate & Set Required Fields
function validateProductOrder(payload) {
  if (!payload['@type']) throw new Error("Missing '@type'");
  payload.id = payload.id || uuidv4();
  payload.creationDate = payload.creationDate || new Date().toISOString();

  if (!Array.isArray(payload.productOrderItem)) {
    throw new Error("Missing or invalid productOrderItem array");
  }

  payload.productOrderItem.forEach(item => {
    item['@type'] = item['@type'] || 'ProductOrderItem';

    if (!item.product) {
      throw new Error(`Missing product in item`);
    }

    item.product['@type'] = item.product['@type'] || 'UNI';
    if (item.product.productCharacteristic?.length > 0) {
      item.product.productCharacteristic.forEach(ch => {
        ch['@type'] = ch['@type'] || 'ObjectCharacteristic';
        if (typeof ch.value !== 'object') {
          throw new Error(`Invalid characteristic value: must be an object`);
        }
        ch.value['@type'] = ch.value['@type'] || 'StringCharacteristicValue';
      });
    }
  });

  if (payload.relatedParty?.length > 0) {
    payload.relatedParty.forEach(p => {
      p['@type'] = p['@type'] || 'RelatedPartyRefOrPartyRoleRef';
      if (p.partyOrPartyRole) {
        p.partyOrPartyRole['@type'] = p.partyOrPartyRole['@type'] || 'PartyRef';
      }
    });
  }

  return payload;
}

// POST /tmf-api/productOrderingManagement/v5/productOrder/productOrder
app.post(/^\/tmf-api\/productOrderingManagement\/v5\/productOrder\/productOrder\/?$/, async (req, res) => {
  const payload = req.body;

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: "Invalid or missing JSON payload" });
  }

  try {
    const cleanPayload = validateProductOrder(payload);

    const newOrder = new ProductOrder(cleanPayload);
    await newOrder.save();
    console.log("✅ Order saved successfully:", newOrder.id);

    const locationUrl = `/tmf-api/productOrderingManagement/v5/productOrder/productOrder/${cleanPayload.id}`;
    res.setHeader("Location", locationUrl);
    return res.status(201).json(newOrder);
  } catch (err) {
    console.error("❌ Failed to save order:", err.message);
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// GET /tmf-api/productOrderingManagement/v5/productOrder/productOrder
app.get(/^\/tmf-api\/productOrderingManagement\/v5\/productOrder\/productOrder\/?$/, async (req, res) => {
  try {
    let query = {};
    const { state, completionDate, creationDate } = req.query;

    if (state) query.state = state;
    if (completionDate) query.completionDate = completionDate;
    if (creationDate) query.creationDate = creationDate;

    const result = await ProductOrder.find(query);

    const filteredResult = req.query.fields
      ? result.map(order => {
          const fieldList = req.query.fields.split(",");
          const mandatoryFields = ["id", "@type", "state"];
          const allFields = [...new Set([...fieldList, ...mandatoryFields])];

          const obj = order.toObject();
          const filtered = {};

          allFields.forEach(key => {
            if (obj.hasOwnProperty(key)) {
              filtered[key] = obj[key];
            }
          });

          return filtered;
        })
      : result;

    return res.status(200).json(filteredResult);
  } catch (err) {
    return res.status(500).json({ error: "Server error", message: err.message });
  }
});

// GET /tmf-api/productOrderingManagement/v5/productOrder/productOrder/:id
app.get(/^\/tmf-api\/productOrderingManagement\/v5\/productOrder\/productOrder\/([^\/]+)\/?$/, async (req, res) => {
  const orderId = req.params[0];

  if (!orderId || orderId === 'undefined') {
    return res.status(400).json({ error: "Missing or invalid order ID in URL" });
  }

  try {
    const order = await ProductOrder.findOne({ id: orderId });

    if (!order) {
      return res.status(404).json({ error: `Order ${orderId} not found` });
    }

    if (req.query.fields) {
      const fieldList = req.query.fields.split(",");
      const mandatoryFields = ["id", "@type", "state"];
      const allFields = [...new Set([...fieldList, ...mandatoryFields])];

      const obj = order.toObject();
      const filtered = {};

      allFields.forEach(key => {
        if (obj.hasOwnProperty(key)) {
          filtered[key] = obj[key];
        }
      });

      return res.json(filtered);
    }

    return res.json(order);
  } catch (err) {
    return res.status(500).json({ error: "Database error", message: err.message });
  }
});

// ❌ Catch-all for undefined routes
app.use((req, res) => {
  res.status(404).json({
    error: "Route Not Found",
    path: req.originalUrl
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

