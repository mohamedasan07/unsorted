import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  id: Number,
  name: String,
  description: String,
  category: String,
  price: Number,
  oldPrice: Number,
  imageUrl: String,
  stockQuantity: Number,
  sale: Boolean
});

export default mongoose.model('Product', ProductSchema);