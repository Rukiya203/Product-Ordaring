const mongoose = require('mongoose');
const { Schema } = mongoose;

function setType(type) {
  return { type: String, default: type };
}

// Characteristic Value (must be an object)
const CharacteristicValueSchema = new Schema({
  '@valueSchemaLocation': String,
  '@type': { type: String, required: true },
  value: Schema.Types.Mixed // allows both primitive and nested objects
});

// Object Characteristic
const ObjectCharacteristicSchema = new Schema({
  '@type': setType('ObjectCharacteristic'),
  id: String,
  name: String,
  valueType: String,
  value: { type: CharacteristicValueSchema, required: true }
});

// Product Specification Ref
const ProductSpecificationRefSchema = new Schema({
  id: String,
  href: String,
  version: String,
  name: String,
  '@type': setType('ProductSpecificationRef')
});

// UNI Product
const UNIProductSchema = new Schema({
  isBundle: Boolean,
  '@type': setType('UNI'),
  productSpecification: ProductSpecificationRefSchema,
  productCharacteristic: [ObjectCharacteristicSchema]
});

// Product Order Item
const ProductOrderItemSchema = new Schema({
  id: String,
  quantity: Number,
  action: String,
  product: UNIProductSchema,
  '@type': setType('ProductOrderItem')
});

// Party Ref
const PartyRefSchema = new Schema({
  id: String,
  href: String,
  name: String,
  '@type': setType('PartyRef'),
  '@referredType': String
});

// Related Party
const RelatedPartySchema = new Schema({
  role: String,
  partyOrPartyRole: PartyRefSchema,
  '@type': setType('RelatedPartyRefOrPartyRoleRef')
});

// External Identifier
const ExternalIdentifierSchema = new Schema({
  '@type': setType('ExternalIdentifier'),
  owner: String,
  externalIdentifierType: String,
  id: String
});

// Main ProductOrder Schema
const ProductOrderSchema = new Schema({
  id: { type: String, required: true, unique: true },
  '@type': setType('ProductOrder'),
  '@schemaLocation': String,
  category: String,
  description: String,
  externalId: [ExternalIdentifierSchema],
  priority: String,
  requestedCompletionDate: Date,
  requestedStartDate: Date,
  productOrderItem: [ProductOrderItemSchema],
  relatedParty: [RelatedPartySchema],
  state: { type: String, default: 'inProgress' },
  completionDate: Date,
  creationDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ProductOrder', ProductOrderSchema);