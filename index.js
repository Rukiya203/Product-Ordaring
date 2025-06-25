const express = require('express');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());
app.use(cors());

// Load Mongoose model
const ProductOrder = require('./models/ProductOrder');

// MongoDB Connection
const MONGO_URI =
  "mongodb+srv://rukshan:ran12345@cluster0.gbrxc7t.mongodb.net/product_order_db?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Middleware to log every incoming request
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.originalUrl}`);
  next();
});

// POST route for creating a new ProductOrder
app.post(/^\/tmf-api\/productOrderingManagement\/v5\/productOrder\/productOrder\/?$/, async (req, res) => {
  const payload = req.body;

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: "Invalid or missing JSON payload" });
  }

  try {
    // Set defaults
    payload.id = payload.id || uuidv4();
    payload['@type'] = payload['@type'] || 'ProductOrder';
    payload.state = payload.state || 'inProgress';
    payload.creationDate = new Date().toISOString();

    const newOrder = new ProductOrder(payload);
    await newOrder.save();

    const locationUrl = `/tmf-api/productOrderingManagement/v5/productOrder/productOrder/${payload.id}`;
    res.setHeader("Location", locationUrl);
    return res.status(201).json(newOrder);
  } catch (err) {
    console.error("❌ Failed to save order:", err.message);
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// GET all Product Orders
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

// GET single order by ID
app.get(/^\/tmf-api\/productOrderingManagement\/v5\/productOrder\/productOrder\/([^\/]+)\/?$/, async (req, res) => {
  const orderId = req.params[0];

  try {
    const order = await ProductOrder.findOne({ id: orderId });

    if (!order) {
      return res.status(404).json({ error: `Order ${orderId} not found` });
    }

    return res.json(order);
  } catch (err) {
    return res.status(500).json({ error: "Database error", message: err.message });
  }
});

// ❌ Catch-all for undefined paths
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